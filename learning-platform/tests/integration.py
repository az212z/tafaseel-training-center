"""Isolated API integration and authorization tests; never touches the center's database."""
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
with tempfile.TemporaryDirectory(prefix='tafaseel-test-') as temp:
    temp=pathlib.Path(temp);mysql_socket=os.environ.get('TAFASEEL_TEST_MYSQL_SOCKET');mysql_name='tafaseel_test_'+os.urandom(5).hex()
    if mysql_socket:subprocess.run(['mariadb','--no-defaults','--socket='+mysql_socket,'-u','root','-e','CREATE DATABASE '+mysql_name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'],check=True)
    dsn=f'mysql:unix_socket={mysql_socket};dbname={mysql_name};charset=utf8mb4' if mysql_socket else f'sqlite:{temp}/test.sqlite'
    config=temp/'config.php';config.write_text("<?php return "+'['+f"'environment'=>'local','demo'=>false,'origin'=>'{ORIGIN}','dsn'=>'{dsn}','db_user'=>'root','db_password'=>'','key'=>'{os.urandom(32).hex()}','storage'=>'{temp}/storage'"+'];')
    env={**os.environ,'TAFASEEL_CONFIG':str(config)}
    subprocess.run(['php',str(ROOT/'server/console.php'),'migrate'],env=env,check=True,capture_output=True)
    password='Integration-test-password-93!'
    seed=temp/'seed.php';seed.write_text("<?php require "+repr(str(ROOT/'server/bootstrap.php'))+"; foreach(['admin','instructor','student','guardian'] as $role){run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$role,$role,$role.'@example.test',password_hash('"+password+"',PASSWORD_DEFAULT),$role,now()]);} ")
    subprocess.run(['php',str(seed)],env=env,check=True,capture_output=True)
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    log=open(temp/'php.log','w');server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(ROOT/'public'),str(ROOT/'server/router.php')],env=env,stdout=log,stderr=log)
    try:
        base=f'http://127.0.0.1:{port}'
        for _ in range(50):
            try:guest=Client(base);break
            except Exception:time.sleep(.1)
        query_file=temp/'query.php';query_file.write_text("<?php require "+repr(str(ROOT/'server/bootstrap.php'))+"; $d=json_decode(stream_get_contents(STDIN),true);$s=db()->prepare($d['sql']);$s->execute($d['args']??[]);echo json_encode($s->fetchAll(PDO::FETCH_NUM));")
        def sql(query,args=[]):
            r=subprocess.run(['php',str(query_file)],input=json.dumps({'sql':query,'args':args}),env=env,text=True,capture_output=True,check=True);return json.loads(r.stdout)
        health,health_headers=guest.call('health');check(health['ok'] and bool(re.fullmatch('[a-f0-9]{24}',health_headers.get('X-Request-ID',''))),'Health response includes a non-sensitive request reference')
        guest.get('health&action[]=health',400);check(True,'Array action rejected as a bad request rather than a server failure')
        guest.get('invalid%2Faction',400);check(True,'Malformed action rejected before dispatch')
        guest.get('data',401);check(True,'Unauthenticated data denied')
        guest.post('demo',{'role':'admin'},404);check(True,'Demo entry disabled outside demo configuration')
        guest.post('login',{'email':'admin@example.test','password':password},403,{'X-CSRF-Token':'invalid'});check(True,'CSRF required before login')
        guest.post('login',{'email':'admin@example.test','password':password},403,{'Origin':'https://evil.test'});check(True,'Foreign Origin rejected')
        admin=Client(base);admin.post('login',{'email':'admin@example.test','password':password})
        cookies=list(admin.jar);check(all(c.has_nonstandard_attr('HttpOnly') for c in cookies),'Session cookie is HttpOnly');check(any(c.get_nonstandard_attr('SameSite')=='Strict' for c in cookies),'Session cookie is SameSite Strict')
        trainer=Client(base);trainer.post('login',{'email':'instructor@example.test','password':password})
        student=Client(base);student.post('login',{'email':'student@example.test','password':password})
        guardian=Client(base);guardian.post('login',{'email':'guardian@example.test','password':password})
        sql('INSERT INTO settings(setting_key,value) VALUES(?,?)',['admin_login',json.dumps({'username':'CenterAdminQA','user_id':'admin'})])
        alias=Client(base);alias_login=alias.post('login',{'email':'cEnTeRaDmInQa','password':password})
        check(alias_login['user']['role']=='admin' and alias_login['user']['username']=='CenterAdminQA','Administrator username accepts case-insensitive login and appears only in owner session')
        check('admin_login' not in json.dumps(guest.get('session')) and 'CenterAdminQA' not in json.dumps(student.get('data')),'Administrator alias settings are absent from public and student responses')
        alias.post('logout',{});alias.post('login',{'email':'UnknownAdminQA','password':password},401);alias.post('login',{'email':'CenterAdminQA','password':'Incorrect-test-password-93!'},401)
        sql('UPDATE settings SET value=? WHERE setting_key=?',[json.dumps({'username':'CenterAdminQA','user_id':'student'}),'admin_login']);alias.post('login',{'email':'CenterAdminQA','password':password},401)
        check(True,'Unknown usernames, wrong passwords and alias mappings to non-administrators cannot authenticate')
        sql('UPDATE settings SET value=? WHERE setting_key=?',[json.dumps({'username':'CenterAdminQA','user_id':'admin'}),'admin_login'])
        rotated='Different-test-password-94!';rotation=temp/'rotate.php';rotation.write_text("<?php require "+repr(str(ROOT/'server/bootstrap.php'))+";run(\"UPDATE users SET password=?,auth_version=auth_version+1 WHERE id='admin'\",[password_hash('"+rotated+"',PASSWORD_DEFAULT)]);")
        subprocess.run(['php',str(rotation)],env=env,check=True,capture_output=True);admin.get('data',401);alias.post('login',{'email':'CenterAdminQA','password':password},401);alias.post('login',{'email':'CenterAdminQA','password':rotated});alias.post('password',{'current':rotated,'password':password});alias.post('logout',{})
        admin.post('login',{'email':'admin@example.test','password':password});check(True,'Credential rotation invalidates prior sessions and password while preserving email login')
        account={'name':'إدارة تفاصيل المحدثة','email':'owner-updated@example.test','current':password}
        for restricted in [student,trainer,guardian]:restricted.post('account.profile',account,403)
        check(True,'Only administrator can update the administration profile')
        admin.post('account.profile',{**account,'current':'Incorrect-password-93!'},422)
        admin.post('account.profile',{**account,'email':'student@example.test'},409)
        check(True,'Administration profile requires current password and unique email')
        auth_before=sql('SELECT password,auth_version,mfa_secret FROM users WHERE id=?',['admin'])
        admin.post('account.profile',{**account,'id':'student','role':'student','password':'Unrequested-password-93!'})
        updated=admin.get('data')['user']
        check(updated['id']=='admin' and updated['role']=='admin' and updated['email']==account['email'] and updated['name']==account['name'],'Administrator edits own name and email without accepting target or role overrides')
        check(sql('SELECT password,auth_version,mfa_secret FROM users WHERE id=?',['admin'])==auth_before,'Profile edit preserves password, sessions and MFA configuration')
        check(len(sql("SELECT id FROM audit WHERE action='account.profile_updated' AND actor_id='admin'"))==1,'Administration profile update records the actor in audit log')
        new_login=Client(base);new_login.post('login',{'email':account['email'],'password':password});new_login.post('logout',{})
        admin.post('account.profile',{'name':'admin','email':'admin@example.test','current':password})
        check(True,'Updated administrator email works for authenticated login')
        body={'role':'student','name':'طالب اختبار','email':'child@example.test','password':password,'birth_date':'2015-01-01','phone':'','city':'تبوك','identity_number':'1000000001','guardian_name':'ولي اختبار','guardian_phone':'٠٥٠٠٠٠٠٠٠١','guardian_id':'guardian','consent':True}
        invalid={**body,'guardian_phone':''};admin.post('user.save',invalid,422);check(True,'Guardian data mandatory for minors')
        child=admin.post('user.save',body)['id'];check(True,'Student creation accepts Arabic phone digits')
        guardian.get('student&id='+child);check(True,'Linked guardian may read own child')
        guardian.get('student&id=student',403);check(True,'Guardian cannot read unrelated student')
        trainer.get('student&id='+child,403);check(True,'Unassigned instructor cannot read child')
        course={'title':'دورة اختبار تكامل','description':'محتوى تدريبي للتحقق من الإجراءات والصلاحيات.','category':'القدرات العامة','image':'/images/courses/foundation.webp','instructor_id':'instructor','duration':12,'capacity':2,'status':'published'}
        cid=admin.post('course.save',course)['id'];admin.post('enroll',{'course_id':cid,'student_id':'student'});admin.post('enroll',{'course_id':cid,'student_id':child})
        admin.post('enroll',{'course_id':cid,'student_id':'student'},409);check(True,'Duplicate enrollment denied')
        second=admin.post('course.save',{**course,'title':'دورة محجوبة','instructor_id':None})['id']
        trainer.post('lesson.save',{'course_id':second,'title':'غير مسموح','kind':'text','body':'غير مسموح'},403);check(True,'Instructor cannot modify unassigned course')
        student.post('user.save',body,403);check(True,'Student cannot create or escalate accounts')
        profile=trainer.get('student&id='+child)['profile'];check('identity_number' not in profile and 'guardian_phone' not in profile,'Instructor response excludes private identity and guardian contacts')
        lid=trainer.post('lesson.save',{'course_id':cid,'title':'درس اختبار أول','kind':'text','body':'محتوى تعليمي لاختبار سير التعلم.','duration':10,'sort_order':1})['id']
        student.post('progress',{'lesson_id':lid});student.post('progress',{'lesson_id':lid});check(len(student.get('data')['progress'])==1,'Lesson completion is idempotent')
        aid=trainer.post('assignment.save',{'course_id':cid,'title':'واجب اختبار','description':'اكتب الإجابة التجريبية.','due_at':'2099-01-01T10:00:00Z','points':20})['id']
        sub=student.post('submission.save',{'assignment_id':aid,'body':'إجابة متكاملة للاختبار.'})['id'];trainer.post('submission.grade',{'id':sub,'score':21},422);trainer.post('submission.grade',{'id':sub,'score':18,'feedback':'تطبيق جيد.'});student.post('submission.save',{'assignment_id':aid,'body':'تعديل بعد التقييم'},409);check(True,'Assignment submission and bounded grading; no edits after grade')
        questions=[{'text':'سؤال أول للاختبار؟','options':['إجابة صحيحة','إجابة أخرى'],'correct':0},{'text':'سؤال ثان للاختبار؟','options':['خيار أول','خيار صحيح'],'correct':1}]
        qid=trainer.post('quiz.save',{'course_id':cid,'title':'اختبار تكامل','minutes':10,'passing':50,'max_attempts':1,'questions':questions})['id']
        student.get('quiz&id='+qid,403);check(True,'Students cannot access quiz answer key')
        attempt=student.post('quiz.start',{'id':qid})['id'];again=student.post('quiz.start',{'id':qid})['id'];check(attempt==again,'Resuming quiz does not create another attempt or restart timer')
        view=student.get('quiz.attempt&id='+attempt);check(all('correct' not in q for q in view['attempt']['questions']),'Active attempt strips correct answers')
        answer=student.post('quiz.submit',{'id':attempt,'answers':[0,1],'score':999});check(answer['score']==2 and answer['total']==2,'Quiz is graded on server and ignores client score')
        answer2=student.post('quiz.submit',{'id':attempt,'answers':[1,0]});check(answer2['score']==2,'Submitted attempt cannot be regraded by client')
        student.post('quiz.start',{'id':qid},409);check(True,'Attempt quota enforced')
        classid=trainer.post('class.save',{'course_id':cid,'title':'حصة اختبار','starts_at':'2020-01-01T10:00:00Z','ends_at':'2020-01-01T11:00:00Z','location':'قاعة اختبار'})['id']
        trainer.post('attendance.save',{'class_id':classid,'records':[{'student_id':'student','status':'present'}]});trainer.post('attendance.save',{'class_id':classid,'records':[{'student_id':'student','status':'absent'}]},422);trainer.post('attendance.save',{'class_id':classid,'records':[{'student_id':'student','status':'late','note':'تصحيح وقت الوصول'}]});check(True,'Attendance correction requires an audit reason')
        student.post('attendance.save',{'class_id':classid,'records':[]},403);check(True,'Student cannot self-award attendance')
        additional={'course_id':cid,'title':'حصة اكتمال الرصد','starts_at':'2099-01-01T10:00:00Z','ends_at':'2099-01-01T11:00:00Z','location':'قاعة اختبار'}
        additional_id=trainer.post('class.save',additional)['id']
        trainer.post('certificate.issue',{'course_id':cid,'student_id':'student'},422);check(True,'Certificate blocked before future classes finish')
        sql('UPDATE classes SET starts_at=?,ends_at=? WHERE id=?',['2020-01-02T10:00:00Z','2020-01-02T11:00:00Z',additional_id]) # Advance fixture clock without changing production scheduling
        trainer.post('certificate.issue',{'course_id':cid,'student_id':'student'},422);check(True,'Certificate requires attendance finalized for each class')
        trainer.post('attendance.save',{'class_id':additional_id,'records':[{'student_id':'student','status':'excused'}]});check(True,'Excused absence excluded from attendance denominator')
        cert=trainer.post('certificate.issue',{'course_id':cid,'student_id':'student'});check(bool(cert['id']),'Certificate issued only after passing course requirements')
        trainer.post('certificate.issue',{'course_id':cid,'student_id':child},422);check(True,'Incomplete learner cannot receive certificate')
        pdf=b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'
        file=admin.upload(pdf,student=child,purpose='identity');trainer.get('file&id='+file['id'],403);student.get('file&id='+file['id'],403);guardian.get('file&id='+file['id']);check(True,'Identity file accessible only to linked child or guardian and admin')
        resource=trainer.upload(pdf,course=cid);student.get('file&id='+resource['id']);check(True,'Enrolled student can download course resource')
        trainer.upload(b'<?php echo "bad"; ?>',filename='malicious.php',mime='application/x-php',course=cid,expected=422);trainer.upload(b'<svg onload="alert(1)"></svg>',filename='image.svg',mime='image/svg+xml',course=cid,expected=422);check(True,'Executable and SVG uploads rejected')
        stored=sql('SELECT identity_number,guardian_phone FROM profiles WHERE user_id=?',[child])[0];check('1000000001' not in stored and '+966500000001' not in stored,'Identity and guardian phone encrypted at rest')
        names=[p.read_bytes() for p in (temp/'storage/files').iterdir()];check(all(not b.startswith(b'%PDF') for b in names),'Uploaded files encrypted outside public root')
        data=guardian.get('data');check(all(s['id']==child for s in data['students']),'Guardian data endpoint excludes unrelated learners');check('users' not in data and 'audit' not in data,'Private administration data omitted for guardian')
        secret=trainer.post('mfa.begin',{'password':password})['secret'];key=base64.b32decode(secret);counter=int(time.time()//30);digest=hmac.new(key,struct.pack('>Q',counter),hashlib.sha1).digest();offset=digest[-1]&15;code=str((struct.unpack('>I',digest[offset:offset+4])[0]&0x7fffffff)%1000000).zfill(6);trainer.post('mfa.confirm',{'code':code});check(trainer.get('data')['mfa'],'TOTP enrollment requires password and valid code')
        fresh=Client(base);r=fresh.post('login',{'email':'instructor@example.test','password':password});check(r.get('mfaRequired') and not r.get('user'),'Password alone cannot bypass enabled TOTP');fresh.get('data',401);fresh.post('login.mfa',{'code':code},401);check(True,'TOTP enrollment code cannot be replayed as login code')
        sql("UPDATE users SET mfa_secret=(SELECT mfa_secret FROM (SELECT mfa_secret FROM users WHERE id='instructor') AS enrolled) WHERE id='admin'")
        alias_mfa=Client(base);challenge=alias_mfa.post('login',{'email':'CenterAdminQA','password':password});check(challenge.get('mfaRequired') and not challenge.get('user'),'Administrator username cannot bypass enabled MFA');alias_mfa.get('data',401);sql("UPDATE users SET mfa_secret=NULL WHERE id='admin'")
        admin.post('user.toggle',{'id':'student'});student.get('data',401);check(True,'Disabling user invalidates existing session immediately')
        admin.post('logout',{});admin.get('data',401);check(True,'Logout invalidates session')
        sql('DELETE FROM rate_limits')
        admin.post('login',{'email':'admin@example.test','password':password})
        # Deadline is enforced using the stored server timestamp, regardless of client score.
        q2=trainer.post('quiz.save',{'course_id':cid,'title':'اختبار مهلة','minutes':1,'passing':50,'max_attempts':1,'questions':questions})['id']
        expired=guardian.post('quiz.start',{'id':q2},403)
        a2=Client(base);a2.post('login',{'email':'child@example.test','password':password})
        att2=a2.post('quiz.start',{'id':q2})['id'];sql('UPDATE attempts SET expires_at=? WHERE id=?',['2020-01-01T00:00:00Z',att2])
        expired=a2.post('quiz.submit',{'id':att2,'answers':[0,1]});check(expired['score']==0 and expired['expired'],'Expired quiz cannot receive client-claimed credit')
        future=trainer.post('class.save',{'course_id':cid,'title':'حصة مستقبلية','starts_at':'2099-01-01T10:00:00Z','ends_at':'2099-01-01T11:00:00Z','location':'قاعة اختبار'})['id']
        trainer.post('attendance.save',{'class_id':future,'records':[{'student_id':child,'status':'present'}]},422);check(True,'Attendance cannot be recorded early for future classes')
        admin.post('course.save',{**course,'id':cid,'capacity':1},422);check(True,'Capacity cannot be lowered below existing enrollments')
        student.get('data',401)
        a2.post('lesson.save',{'course_id':cid,'title':'تجاوز صلاحية','kind':'text','body':'غير مسموح'},403);check(True,'Learner cannot create lessons')
        trainer.post('lesson.save',{'course_id':cid,'title':'رابط غير آمن','kind':'video','video_url':'javascript:alert(1)'},422)
        trainer.post('lesson.save',{'course_id':cid,'title':'رابط ناقص','kind':'video','video_url':'https://www.youtube.com/'},422);check(True,'Video URLs require HTTPS, allowed host, and valid media ID')
        # Import from a consistent read-only synthetic legacy snapshot, twice.
        import sqlite3
        legacy_path=temp/'legacy.sqlite';legacy=sqlite3.connect(legacy_path)
        legacy.executescript("CREATE TABLE students(id TEXT,name TEXT,email TEXT,mobile TEXT,guardian TEXT,city TEXT);CREATE TABLE programs(id TEXT,short_title TEXT);CREATE TABLE courses(slug TEXT,title TEXT,description TEXT,program_id TEXT);CREATE TABLE cohorts(id INTEGER,course_slug TEXT,number INTEGER,capacity INTEGER);CREATE TABLE registrations(id TEXT,student_id TEXT,course_slug TEXT,cohort_id INTEGER,status TEXT);INSERT INTO students VALUES('old1','طالب سابق','old1@example.test','0500000002','ولي سابق','تبوك');INSERT INTO programs VALUES('p','مسار سابق');INSERT INTO courses VALUES('old-course','دورة سابقة','وصف دورة سابقة','p');INSERT INTO cohorts VALUES(1,'old-course',1,20);INSERT INTO cohorts VALUES(2,'old-course',2,20);INSERT INTO registrations VALUES('r1','old1','old-course',1,'registered');INSERT INTO registrations VALUES('r2','old1','old-course',2,'registered');")
        legacy.commit();legacy.close();source_hash=hashlib.sha256(legacy_path.read_bytes()).hexdigest()
        subprocess.run(['php',str(ROOT/'server/import-legacy.php'),str(legacy_path)],env=env,check=True,capture_output=True)
        check(not sql("SELECT id FROM legacy_links"),'Legacy dry-run leaves target unchanged')
        for _ in range(2):subprocess.run(['php',str(ROOT/'server/import-legacy.php'),str(legacy_path),'--apply'],env=env,check=True,capture_output=True)
        check(sql("SELECT COUNT(*) FROM legacy_links WHERE kind='student'")[0][0]==1,'Legacy import is idempotent')
        check(sql("SELECT COUNT(*) FROM legacy_links WHERE kind='cohort'")[0][0]==2,'Legacy cohorts remain separate courses')
        old=sql("SELECT u.id,u.active,p.birth_date FROM users u JOIN profiles p ON p.user_id=u.id JOIN legacy_links l ON l.new_id=u.id WHERE l.kind='student'")[0]
        check(old[1]==0 and not old[2],'Imported learner remains disabled until data review')
        admin.post('user.toggle',{'id':old[0]},422);check(True,'Imported minor cannot activate without birth date and consent review')
        check(hashlib.sha256(legacy_path.read_bytes()).hexdigest()==source_hash,'Legacy source snapshot remains byte-for-byte unchanged')
        sql('DELETE FROM rate_limits')
        limit=Client(base)
        for i in range(13):r=limit.post('login',{'email':'unknown@example.test','password':'wrong-password'},429 if i>=12 else 401)
        check(True,'Login brute-force rate limit enforced')
        print(json.dumps({'database':'MariaDB' if mysql_socket else 'SQLite','passed':len(passed),'failed':0,'checks':passed},ensure_ascii=False,indent=2))
    finally:
        server.terminate();server.wait(timeout=5);log.close()
        if mysql_socket:subprocess.run(['mariadb','--no-defaults','--socket='+mysql_socket,'-u','root','-e','DROP DATABASE '+mysql_name],check=True)
