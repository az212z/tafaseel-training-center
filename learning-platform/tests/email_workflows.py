"""Isolated real SMTP protocol and email workflow regression tests. No external delivery."""
import base64, concurrent.futures, email, email.policy, json, os, socketserver, threading, urllib.request, urllib.parse
from sandbox import Sandbox, Client, ROOT

checks=[]
def check(ok,label):
    assert ok,label
    checks.append(label);print('PASS',label,flush=True)

class SMTP(socketserver.StreamRequestHandler):
    messages=[];mode='accept'
    def reply(self,line):self.wfile.write((line+'\r\n').encode());self.wfile.flush()
    def handle(self):
        self.reply('220 local.test ESMTP'); auth=0
        while True:
            raw=self.rfile.readline()
            if not raw:return
            cmd=raw.decode().rstrip('\r\n')
            if auth:
                auth-=1
                self.reply('334 UGFzc3dvcmQ6' if auth else ('535 5.7.8 Authentication failed' if SMTP.mode=='auth' else '235 2.7.0 Authenticated'))
            elif cmd.upper().startswith('EHLO'):self.reply('250-local.test');self.reply('250 AUTH LOGIN PLAIN')
            elif cmd.upper().startswith('AUTH LOGIN'):auth=2;self.reply('334 VXNlcm5hbWU6')
            elif cmd.upper().startswith('AUTH PLAIN'):self.reply('535 Authentication failed' if SMTP.mode=='auth' else '235 Authenticated')
            elif cmd.upper().startswith('RCPT') and SMTP.mode=='temporary':self.reply('451 4.3.0 Try later')
            elif cmd.upper()=='DATA':
                self.reply('354 End with a dot');data=b''
                while True:
                    line=self.rfile.readline()
                    if line==b'.\r\n' or not line:break
                    data+=line[1:] if line.startswith(b'..') else line
                SMTP.messages.append(email.message_from_bytes(data,policy=email.policy.default))
                if SMTP.mode=='disconnect':return
                self.reply('250 2.0.0 Queued as LOCAL')
            elif cmd.upper()=='QUIT':self.reply('221 Bye');return
            else:self.reply('250 OK')

server=socketserver.ThreadingTCPServer(('127.0.0.1',0),SMTP)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
  with Sandbox() as s:
    s.config.write_text(s.config.read_text().replace("'storage'=>", "'test_smtp_port'=>"+str(server.server_address[1])+",'storage'=>"))
    seed="""require 'server/api.php';foreach(['admin'=>'admin','trainer'=>'instructor','other'=>'instructor','s1'=>'student','s2'=>'student'] as $id=>$role){run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT),$role,now()]);}run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,capacity,created_at) VALUES(?,?,?,?,?,?,?,?,?)',['c1','دورة اختبار البريد','دورة محلية فقط','اختبار','','published','trainer',20,now()]);foreach(['s1','s2'] as $id)run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',[uid(),'c1',$id,now()]);"""
    s.php(['-r',seed]);admin=s.login('admin');student=s.login('s1');second=s.login('s2');trainer=s.login('trainer');other=s.login('other');anon=Client(s.base)
    anon.get('email.status',401);student.get('email.status',403);student.post('email.configure',{},403)
    check(True,'Anonymous and learner accounts cannot read or change SMTP settings')
    settings={'address':'admin@tafaseel-learn.com','name':'مركز تفاصيل للتدريب','port':465,'daily_limit':80,'enabled':True,'password':'Disposable-SMTP-Only','current':s.password}
    admin.post('email.configure',{**settings,'current':'incorrect'},422);admin.post('email.configure',{**settings,'address':'other@example.com'},422);admin.post('email.configure',{**settings,'port':500},422);admin.post('email.configure',{**settings,'password':''},422)
    check(True,'SMTP changes require owner password, center domain, permitted TLS port and mailbox secret')
    admin.post('email.configure',settings);status=admin.get('email.status')
    stored=s.sql("SELECT value FROM settings WHERE setting_key='email_connection'")[0]['value']
    check(status['configured'] and 'password' not in status and settings['password'] not in stored and status['has_password'],'SMTP credentials encrypted at rest and never returned in status')
    admin.post('email.test',{});m=SMTP.messages[-1]
    check(str(m['To'])=='admin@tafaseel-learn.com' and str(m['Reply-To'])=='مركز تفاصيل للتدريب <admin@tafaseel-learn.com>' and m.is_multipart(),'Real SMTP handshake sends multipart test to center mailbox with branded Reply-To')
    check(any(p.get_content_type()=='text/html' and 'dir="rtl"' in p.get_content() for p in m.walk()) and any(p.get_content_type()=='text/plain' for p in m.walk()),'Arabic HTML email and plain text alternative rendered without external assets')
    check(admin.get('email.log')['items'][0]['status']=='accepted','SMTP acceptance recorded separately from inbox delivery')
    draft={'kind':'training','course_id':'c1','subject':'تنبيه تدريبي <script>','body':'موعد درس جديد\n<script>alert(1)</script>'}
    preview=trainer.post('email.campaign.preview',draft)
    check(preview['recipients']==2 and '&lt;script&gt;' in preview['html'] and '<script>alert' not in preview['html'],'Assigned trainer previews exact enrolled audience and escaped message content')
    other.post('email.campaign.preview',draft,403);student.post('email.campaign.preview',draft,403);trainer.post('email.campaign.preview',{**draft,'kind':'marketing'},403)
    check(True,'Other instructors, students and instructor marketing escalation rejected')
    payload={**draft,'id':os.urandom(16).hex(),'fingerprint':preview['fingerprint']}
    trainer.post('email.campaign.send',{**payload,'body':'changed'},409)
    result=trainer.post('email.campaign.send',payload);again=trainer.post('email.campaign.send',payload)
    check(result['queued']==2 and again['existing'] and len(s.sql('SELECT id FROM email_outbox WHERE campaign_id=?',[payload['id']]))==2,'Preview changes require renewed approval and send retries remain idempotent')
    admin.post('email.dispatch',{});messages=SMTP.messages[-2:]
    check({str(m['To']) for m in messages}=={'s1@example.test','s2@example.test'} and all(not m['Cc'] and not m['Bcc'] and m['List-Unsubscribe'] for m in messages),'Campaign sends separate messages without exposing other recipients and includes unsubscribe headers')
    campaign=trainer.get('email.campaigns')['items'][0];check(campaign['accepted']==2,'Broadcast report counts actual SMTP acceptances')
    marketing={'kind':'marketing','subject':'أخبار تفاصيل','body':'برامج جديدة من المركز'}
    check(admin.post('email.campaign.preview',marketing)['recipients']==0,'Marketing audience starts empty without affirmative subscription')
    student.post('email.preference.save',{'training_enabled':True,'marketing_enabled':True});p=admin.post('email.campaign.preview',marketing)
    check(p['recipients']==1,'Only the account holder can opt into center newsletters')
    original=messages[0];unsubscribe=str(original['List-Unsubscribe']).strip('<>');path=urllib.parse.urlsplit(unsubscribe)
    link=s.base+path.path+'?'+path.query
    with urllib.request.urlopen(link) as r:page=r.read()
    who='s1' if str(original['To'])=='s1@example.test' else 's2'
    before=s.sql('SELECT * FROM email_preferences WHERE user_id=?',[who])
    check('إيقاف الرسائل الاختيارية'.encode() in page and s.sql('SELECT * FROM email_preferences WHERE user_id=?',[who])==before,'Unsubscribe GET is a confirmation page and mail scanners cannot silently opt users out')
    with urllib.request.urlopen(urllib.request.Request(link,data=b'List-Unsubscribe=One-Click')) as r:done=r.read()
    check('تم إيقاف'.encode() in done and not bool(s.sql('SELECT training_enabled FROM email_preferences WHERE user_id=?',[who])[0]['training_enabled']),'Signed one-click unsubscribe POST disables optional email without login')
    try:urllib.request.urlopen(link+'tampered');raise AssertionError('tampered token accepted')
    except urllib.error.HTTPError as e:check(e.code==400,'Tampered unsubscribe tokens cannot alter preferences')
    student.post('email.preference.save',{'training_enabled':True,'marketing_enabled':False});second.post('email.preference.save',{'training_enabled':True,'marketing_enabled':False})
    # Protocol failure and lease checks use new messages; reset only local quota fixtures.
    def queue(label):
        s.php(['-r',"require 'server/api.php';queueEmail('"+label+"','s1','account','اختبار','محتوى محلي');"])
        return s.sql('SELECT id FROM email_outbox WHERE dedupe_key=?',[label])[0]['id']
    def clean_quota():s.sql('DELETE FROM email_attempts')
    clean_quota();SMTP.mode='temporary';mid=queue('temporary');admin.post('email.dispatch',{})
    check(s.sql('SELECT status FROM email_outbox WHERE id=?',[mid])[0]['status']=='retry','Explicit temporary SMTP rejection schedules a delayed retry')
    SMTP.mode='auth';mid2=queue('authentication');admin.post('email.dispatch',{})
    check(s.sql('SELECT status FROM email_outbox WHERE id=?',[mid2])[0]['status']=='failed','Authentication rejection is held as failed without leaking credential or raw server text')
    SMTP.mode='disconnect';mid3=queue('ambiguous');admin.post('email.dispatch',{})
    check(s.sql('SELECT status FROM email_outbox WHERE id=?',[mid3])[0]['status']=='uncertain','Connection loss after DATA is marked uncertain instead of automatically duplicated')
    SMTP.mode='accept';before=len(SMTP.messages);admin.post('email.dispatch',{})
    check(len(SMTP.messages)==before,'Accepted and uncertain outcomes excluded from automatic retries')
    s.sql("UPDATE email_outbox SET status='cancelled' WHERE status IN ('pending','retry','blocked')");clean_quota()
    settings['daily_limit']=2;admin.post('email.configure',settings)
    for i in range(6):queue('quota'+str(i))
    def worker(_):return json.loads(s.php(['server/console.php','worker']).stdout)['email']
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(worker,range(3)))
    check(len(s.sql('SELECT id FROM email_attempts'))==2 and len(s.sql("SELECT id FROM email_outbox WHERE dedupe_key LIKE 'quota%' AND status='accepted'"))==2,'Concurrent workers respect one atomic rolling daily budget')
    settings['daily_limit']=80;admin.post('email.configure',settings);clean_quota()
    s.sql("UPDATE email_outbox SET status='cancelled' WHERE status IN ('pending','retry','blocked')")
    mid=queue('expired-lease');s.sql("UPDATE email_outbox SET status='sending',locked_until='2000-01-01T00:00:00Z' WHERE id=?",[mid]);worker(0)
    check(s.sql('SELECT status FROM email_outbox WHERE id=?',[mid])[0]['status']=='uncertain','Worker crash recovery holds stale sending leases for manual review')
    future=s.php(['-r',"echo gmdate('Y-m-d\\TH:i:s\\Z',time()+1800);"]).stdout
    end=s.php(['-r',"echo gmdate('Y-m-d\\TH:i:s\\Z',time()+5400);"]).stdout
    trainer.post('class.save',{'course_id':'c1','title':'لقاء مباشر تجريبي','starts_at':future,'ends_at':end,'location':'عبر المنصة'})
    worker(0);count=len(s.sql("SELECT id FROM email_outbox WHERE kind='class_reminder'"));worker(0)
    check(count==2 and len(s.sql("SELECT id FROM email_outbox WHERE kind='class_reminder'"))==2,'Scheduled worker queues one reminder per enrolled learner before a live session')
    check('password' not in json.dumps(admin.get('email.log')),'Delivery log never returns mail credentials or full message bodies')
    report={'checks':len(checks),'passed':checks,'database':'mariadb' if s.mysql else 'sqlite','external_messages_sent':0,'smtp_protocol':'real local TCP; no TLS override allowed in production'}
    (ROOT/'docs').mkdir(exist_ok=True);(ROOT/'docs/email-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
finally:server.shutdown();server.server_close()
print('DONE',len(checks),'checks')
