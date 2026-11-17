"""Public website, content management and inquiry authorization tests; never touches the center's database."""
import os, tempfile, subprocess, pathlib, socket, time, json, urllib.request, urllib.error, http.cookiejar, re, hashlib, hmac, base64, struct
import sys
_original_hook=sys.excepthook
def show_process_error(kind,value,trace):
    if isinstance(value,subprocess.CalledProcessError):
        for output in [value.stdout,value.stderr]:
            if output:print(output.decode(errors='replace') if isinstance(output,bytes) else output,file=sys.stderr)
    _original_hook(kind,value,trace)
sys.excepthook=show_process_error
ROOT=pathlib.Path(__file__).resolve().parents[1]
ORIGIN='http://127.0.0.1:3117'
passed=[]
def check(value,label):
    assert value,label
    passed.append(label)
class Client:
    def __init__(self,base):
        self.base=base;self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar));self.csrf=''
        self.get('session')
    def call(self,action,body=None,method=None,headers=None,expected=200):
        url=self.base+'/api/index.php?action='+action
        data=None if body is None else json.dumps(body,ensure_ascii=False).encode()
        h={'Origin':ORIGIN,'Content-Type':'application/json','X-CSRF-Token':self.csrf}
        h.update(headers or {})
        req=urllib.request.Request(url,data=data,headers=h,method=method or ('POST' if body is not None else 'GET'))
        try:
            with self.opener.open(req) as r: status=r.status; raw=r.read(); response_headers=r.headers
        except urllib.error.HTTPError as e:status=e.code;raw=e.read();response_headers=e.headers
        assert status==expected,(action,status,raw[:300])
        try:result=json.loads(raw)
        except (ValueError,UnicodeDecodeError): result={'raw':raw}
        if 'csrf' in result:self.csrf=result['csrf']
        return result,response_headers
    def get(self,action,expected=200):return self.call(action,expected=expected)[0]
    def post(self,action,body,expected=200,headers=None):return self.call(action,body,expected=expected,headers=headers)[0]
    def upload(self,payload,filename='test.pdf',mime='application/pdf',course=None,student=None,purpose='resource',expected=200):
        boundary='----Tafaseel'+str(time.time_ns());parts=[]
        fields={'purpose':purpose}
        if course:fields['course_id']=course
        if student:fields['student_id']=student
        for k,v in fields.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+payload+f'\r\n--{boundary}--\r\n'.encode())
        req=urllib.request.Request(self.base+'/api/index.php?action=file.upload',data=b''.join(parts),headers={'Origin':ORIGIN,'X-CSRF-Token':self.csrf,'Content-Type':f'multipart/form-data; boundary={boundary}'})
        try:
            with self.opener.open(req) as r:status=r.status;body=r.read()
        except urllib.error.HTTPError as e:status=e.code;body=e.read()
        assert status==expected,(status,body[:300]);return json.loads(body)
with tempfile.TemporaryDirectory(prefix='tafaseel-website-test-') as folder:
    temp=pathlib.Path(folder);mysql_socket=os.environ.get('TAFASEEL_TEST_MYSQL_SOCKET');mysql_name='tafaseel_web_'+os.urandom(5).hex()
    if mysql_socket:subprocess.run(['mariadb','--no-defaults','--socket='+mysql_socket,'-u','root','-e','CREATE DATABASE '+mysql_name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'],check=True)
    dsn=f'mysql:unix_socket={mysql_socket};dbname={mysql_name};charset=utf8mb4' if mysql_socket else f'sqlite:{temp}/test.sqlite'
    config=temp/'config.php';config.write_text("<?php return "+'['+f"'environment'=>'local','demo'=>false,'origin'=>'{ORIGIN}','dsn'=>'{dsn}','db_user'=>'root','db_password'=>'','key'=>'{os.urandom(32).hex()}','storage'=>'{temp}/storage','staff_mfa_enabled'=>false,'enforce_staff_mfa'=>false"+'];')
    env={**os.environ,'TAFASEEL_CONFIG':str(config)}
    subprocess.run(['php',str(ROOT/'server/console.php'),'migrate'],env=env,check=True,capture_output=True)
    password='Website-isolated-test-93!'
    seed=temp/'seed.php';seed.write_text("<?php require "+repr(str(ROOT/'server/bootstrap.php'))+";foreach(['admin','instructor','student','guardian'] as $role){run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$role,$role,$role.'@example.test',password_hash('"+password+"',PASSWORD_DEFAULT),$role,now()]);}")
    subprocess.run(['php',str(seed)],env=env,check=True,capture_output=True)
    query=temp/'query.php';query.write_text("<?php require "+repr(str(ROOT/'server/bootstrap.php'))+";$d=json_decode(stream_get_contents(STDIN),true);$s=db()->prepare($d['sql']);$s->execute($d['args']??[]);echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));")
    def sql(q,args=[]):
        return json.loads(subprocess.run(['php',str(query)],input=json.dumps({'sql':q,'args':args}),env=env,text=True,capture_output=True,check=True).stdout)
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    log=open(temp/'server.log','w');server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(ROOT/'dist'),str(ROOT/'server/preview-router.php')],env=env,stdout=log,stderr=log)
    try:
        base=f'http://127.0.0.1:{port}'
        for _ in range(50):
            try:guest=Client(base);break
            except Exception:time.sleep(.1)
        content=guest.get('website');check(len(content['programs'])==20 and len(content['categories'])==6,'Public catalog has twenty center programs in six categories')
        check(not any('course_id' in p for p in content['programs']) and 'revision' not in content,'Public payload excludes administrative linkage and revision')
        guest.get('website.admin',401);guest.get('website.inquiries',401);guest.post('website.save',{},401);guest.get('website.inquiry',405);check(True,'Content editing and visitor inbox require administrator authentication and correct method')
        admin=Client(base);admin.post('login',{'email':'admin@example.test','password':password})
        for role in ['instructor','student','guardian']:
            restricted=Client(base);restricted.post('login',{'email':role+'@example.test','password':password});restricted.get('website.admin',403);restricted.get('website.inquiries',403);restricted.post('website.inquiry.status',{'id':'missing','status':'closed'},403)
        check(True,'Trainer, student and guardian cannot access visitor contact data or site editing')
        before=admin.get('website.admin');site={**before['site'],'hero_title':'عنوان محدث من إدارة المركز','email':'public@example.test'}
        guest.post('website.inquiry',{'name':'اختبار'},403,{'X-CSRF-Token':'bad'});check(True,'Public contact form requires CSRF token')
        admin.post('website.save',{'section':'site','value':site,'revision':before['revision']});published=guest.get('website');check(published['site']['hero_title']==site['hero_title'],'Admin content edits publish immediately in public API')
        admin.post('website.save',{'section':'site','value':site,'revision':before['revision']},409);check(True,'Concurrent content edits reject stale revisions')
        revision=lambda:admin.get('website.admin')['revision']
        p={**before['programs'][0],'title':'عنوان عام معدل','visible':False,'course_id':''};admin.post('website.save',{'section':'program','slug':p['slug'],'revision':revision(),'value':p})
        check(len(guest.get('website')['programs'])==19 and not any(x['slug']==p['slug'] for x in guest.get('website')['programs']),'Hidden program disappears from public discovery')
        def page(path,expected=200):
            try:
                with urllib.request.urlopen(base+path) as r:status=r.status;body=r.read().decode();headers=r.headers
            except urllib.error.HTTPError as e:status=e.code;body=e.read().decode();headers=e.headers
            assert status==expected,(path,status,body[:100]);return body,headers
        html,_=page('/programs/'+p['slug'],404);check('noindex,nofollow' in html,'Hidden program route returns HTTP 404 and noindex')
        xml,_=page('/sitemap.xml');check('/programs/'+p['slug'] not in xml,'Dynamic sitemap removes hidden programs')
        p['visible']=True;admin.post('website.save',{'section':'program','slug':p['slug'],'revision':revision(),'value':p})
        course={'title':'Private draft title','description':'Private internal description','category':'مسار','status':'draft','duration':9,'capacity':20}
        cid=admin.post('course.save',course)['id'];admin.post('commerce.save',{'course_id':cid,'price_minor':12300,'enrollment_open':True});p['course_id']=cid;admin.post('website.save',{'section':'program','slug':p['slug'],'revision':revision(),'value':p})
        public=guest.get('website');check(public['programs'][0]['availability'] is None and 'Private internal description' not in json.dumps(public),'Linked draft course does not leak private description or enrollment availability')
        admin.post('course.save',{**course,'id':cid,'status':'published'});public=guest.get('website');live=public['programs'][0]['availability'];check(live['open'] and live['price_minor']==12300 and live['duration']==9,'Published linked course exposes verified fee, duration and open enrollment')
        faq=[{'q':'سؤال عام من الإدارة','a':'إجابة منشورة للزوار'}];admin.post('website.save',{'section':'faq','value':faq,'revision':revision()});check(guest.get('website')['faqs']==faq,'FAQ edits publish without exposing private settings')
        article={**before['articles'][0],'title':'مقال إدارة محدث'};admin.post('website.save',{'section':'article','id':article['id'],'value':article,'revision':revision()});check(guest.get('website')['articles'][0]['title']==article['title'],'Library article content is editable by administration')
        new_program={**p,'title':'صفحة برنامج إضافي','visible':True,'category':'development'};admin.post('website.save',{'section':'program','slug':'extra-program','create':True,'revision':revision(),'value':new_program});check(any(x['slug']=='extra-program' for x in guest.get('website')['programs']),'Administrator can create a new public program page linked to an existing educational course')
        admin.post('website.save',{'section':'program','slug':'extra-program','create':True,'revision':revision(),'value':new_program},409);admin.post('website.save',{'section':'program','slug':'../bad','create':True,'revision':revision(),'value':new_program},422);check(True,'New public pages reject duplicate or unsafe URLs')
        admin.post('website.save',{'section':'article','id':'extra-guide','create':True,'revision':revision(),'value':article});check(any(x['id']=='extra-guide' for x in guest.get('website')['articles']),'Administrator can add a new library article without editing source code')
        check(len(sql('SELECT payload FROM website_content')[0]['payload'])>10000,'Content uses expandable dedicated storage instead of the limited settings column')
        policy={**before['pages']['privacy'],'title':'سياسة خصوصية محدثة','sections':[['قسم سياسة محدث','تفاصيل السياسة المنشورة من الإدارة']]};admin.post('website.save',{'section':'page','id':'privacy','revision':revision(),'value':policy});html,_=page('/privacy');check(policy['title'] in html and policy['sections'][0][1] in html,'Policy edits publish to public content and readable server HTML')
        filtered=guest.get('catalog&course_id='+cid);check(filtered['total']==1 and filtered['items'][0]['id']==cid,'Enrollment catalog preserves the course chosen on its public page')
        admin.post('website.save',{'section':'program','slug':p['slug'],'revision':revision(),'value':{**p,'course_id':'not-existing'}},422);admin.post('website.save',{'section':'faq','value':{'bad':'shape'},'revision':revision()},422);check(True,'Invalid course bindings and invalid FAQ payloads cannot publish')
        inquiry={'kind':'program','program_slug':p['slug'],'name':'زائر اختبار معزول','phone':'0500000001','email':'visitor@example.test','message':'استفسار معزول عن مواعيد الدفعة','consent':True}
        guest.post('website.inquiry',{**inquiry,'consent':False},422);guest.post('website.inquiry',{**inquiry,'website':'spam.test'},422);guest.post('website.inquiry',{**inquiry,'program_slug':'missing'},422);check(True,'Contact consent, honeypot and valid program are enforced')
        sql('DELETE FROM rate_limits');result=guest.post('website.inquiry',inquiry);check(bool(re.fullmatch('TF-[A-F0-9]{12}',result['reference'])),'Contact submission returns an unguessable reference and records a real request')
        stored=sql('SELECT * FROM website_inquiries')[0];check(inquiry['name'] not in stored['payload'] and inquiry['phone'] not in stored['payload'] and inquiry['message'] not in stored['payload'],'Visitor name, contact details and message are encrypted at rest')
        inbox=admin.get('website.inquiries');check(inbox['total']==1 and inbox['items'][0]['details']['phone']=='+966500000001' and 'payload' not in inbox['items'][0],'Administrator can read decrypted request without exposing encrypted raw payload')
        admin.post('website.inquiry.status',{'id':stored['id'],'status':'contacted'});check(admin.get('website.inquiries&status=new')['total']==0 and admin.get('website.inquiries&status=contacted')['total']==1,'Inbox status and filters persist without sending an external message')
        for i in range(4):guest.post('website.inquiry',inquiry)
        guest.post('website.inquiry',inquiry,429);check(True,'Public inquiry rate limit blocks repeated submissions')
        sql('INSERT INTO certificates(id,course_id,student_id,serial,issued_at) VALUES(?,?,?,?,?)',['cert-web',cid,'student','TF-2026-ABCDEF1234','2026-11-17T12:00:00Z'])
        cert=guest.post('certificate.verify',{'serial':'TF-2026-ABCDEF1234'});check(cert['valid'] and cert['certificate']['title']==course['title'] and 'student' not in json.dumps(cert) and 'email' not in json.dumps(cert),'Certificate verification proves issuance without disclosing learner identity')
        check(not guest.post('certificate.verify',{'serial':'TF-2026-0000000000'})['valid'],'Unknown certificate has no successful verification');guest.post('certificate.verify',{'serial':'bad'},422)
        html,_=page('/programs/'+p['slug']);check(p['title'] in html and '<link rel="canonical"' in html and '<meta property="og:title"' in html and '<meta name="robots" content="index,follow"' in html,'Server HTML includes current public content, canonical URL and social metadata before JavaScript')
        html,_=page('/library/'+article['id']);check(article['title'] in html and article['sections'][0]['text'] in html,'Public article is readable in server HTML without JavaScript')
        html,_=page('/login');check('noindex,nofollow' in html and inquiry['name'] not in html,'Private entry routes remain noindex and never render inbox data')
        page('/unknown-page',404);check(True,'Unknown public paths return real HTTP 404')
        # Optional authentication policy must be honored by server guards, not just UI.
        production=temp/'production.php';production.write_text("<?php $c=require "+repr(str(config))+";$c['environment']='production';$c['origin']='https://example.test';return $c;")
        probe=temp/'probe.php';probe.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";$u=one(\"SELECT * FROM users WHERE id='admin'\");staffMfaGuard($u,'website.admin');echo json_encode(['required'=>staffNeedsMfa($u),'available'=>dataFor($u)['mfa_available']]);")
        r=json.loads(subprocess.run(['php',str(probe)],env={**env,'TAFASEEL_CONFIG':str(production)},text=True,capture_output=True,check=True).stdout);check(not r['required'] and not r['available'],'Explicit password-only production policy removes server MFA enrollment guard')
        admin.post('mfa.begin',{'password':password},403);check(True,'Disabled additional authentication cannot be enrolled accidentally')
        print(json.dumps({'database':'MariaDB' if mysql_socket else 'SQLite','passed':len(passed),'failed':0,'checks':passed},ensure_ascii=False,indent=2))
    finally:
        server.terminate();server.wait(timeout=5);log.close()
        if mysql_socket:subprocess.run(['mariadb','--no-defaults','--socket='+mysql_socket,'-u','root','-e','DROP DATABASE '+mysql_name],check=True)
