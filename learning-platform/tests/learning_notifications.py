"""Real notification/attendance APIs and minute worker; disposable DB and loopback SMS only."""
import concurrent.futures, datetime, hashlib, hmac, http.server, json, threading, time
from sandbox import Sandbox, ROOT

checks=[]
def check(value,label):
    assert value,label
    checks.append(label);print('PASS '+label,flush=True)
def stamp(seconds=0):
    return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)).strftime('%Y-%m-%dT%H:%M:%SZ')

class SMS(http.server.BaseHTTPRequestHandler):
    messages=[]
    def log_message(self,*args): pass
    def do_POST(self):
        assert self.path=='/sms/messages'
        self.messages.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
        body=json.dumps({'statusCode':201,'messageId':len(self.messages)}).encode()
        self.send_response(201);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

provider=http.server.ThreadingHTTPServer(('127.0.0.1',0),SMS)
threading.Thread(target=provider.serve_forever,daemon=True).start()
try:
  settings={'test_provider_urls':{'sms':'http://127.0.0.1:'+str(provider.server_port)+'/sms'},'integrations':{'sms':{'enabled':True,'token':'local-only','sender':'TEST'},'zoom':{'enabled':True,'account_id':'local-account','client_id':'local-client','client_secret':'local-secret','webhook_secret':'local-webhook'}}}
  with Sandbox(config_overrides=settings) as s:
    s.php(['-r', "require 'server/api.php';$hash=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);foreach(['admin'=>'admin','instructor'=>'instructor','other'=>'instructor','student'=>'student','second'=>'student','third'=>'student','fourth'=>'student','outsider'=>'student','newcomer'=>'student'] as $id=>$role){run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$hash,$role,'2020-01-01T00:00:00Z']);if($role==='student'){run('INSERT INTO profiles(user_id,guardian_phone,consent_at) VALUES(?,?,?)',[$id,enc('+966500000001'),now()]);run('INSERT INTO guardian_preferences(student_id,sms_enabled,consent_at,updated_by,updated_at) VALUES(?,1,?,?,?)',[$id,now(),'admin',now()]);}}run('UPDATE users SET active=0 WHERE id=?',['fourth']);foreach(['course','foreign','draft'] as $id)run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,capacity,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[$id,'دورة اختبار '.$id,'محتوى مستقل','تدريب','/images/courses/foundation.webp',$id==='draft'?'draft':'published',$id==='foreign'?'other':'instructor',50,now()]);foreach(['student','second','third','fourth'] as $id)run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',[$id.'enroll','course',$id,'2020-01-01T00:00:00Z']);run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',['out-enroll','foreign','outsider','2020-01-01T00:00:00Z']);"])
    admin=s.login('admin');teacher=s.login('instructor');other=s.login('other');student=s.login('student');second=s.login('second');outsider=s.login('outsider')
    student.get('sms.connection',403);teacher.get('sms.connection',403)
    admin.post('sms.connection.save',{'enabled':True,'sender':'TAFASEEL','token':'local-test-token-123456','current_password':'wrong-password'},422)
    saved=admin.post('sms.connection.save',{'enabled':True,'sender':'TAFASEEL','token':'local-test-token-123456','current_password':s.password})
    check(saved['configured'] and saved['has_token'] and 'token' not in saved and 'local-test-token' not in s.sql("SELECT value FROM settings WHERE setting_key='sms_connection'")[0]['value'],'SMS connection requires administrator reauthentication and stores its token encrypted without returning it')
    lesson={'course_id':'course','title':'درس جديد','kind':'text','body':'شرح الدرس','duration':15,'sort_order':0}
    lid=teacher.post('lesson.save',lesson)['id']
    teacher.post('assignment.save',{'course_id':'course','title':'واجب جديد','description':'تطبيق عملي','due_at':stamp(86400),'points':20})
    quiz={'course_id':'course','title':'اختبار جديد','minutes':10,'passing':50,'max_attempts':2,'questions':[{'text':'سؤال جديد','options':['أ','ب'],'correct':0}]}
    teacher.post('quiz.save',quiz)
    class_body={'course_id':'course','title':'لقاء جديد','starts_at':stamp(-60),'ends_at':stamp(3600),'location':'عن بُعد','automatic_absence':True,'attendance_mode':'manual'}
    cid=teacher.post('class.save',class_body)['id']
    teacher.post('announcement.save',{'course_id':'course','title':'إعلان جديد','body':'تفاصيل الإعلان'})
    uploaded=teacher.upload(b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n','resource.pdf','application/pdf','course')
    bag=teacher.post('bag.save',{'course_id':'course','title':'حقيبة جديدة','description':'مواد إضافية','version':'1.0'})
    teacher.post('bag.item.save',{'bag_id':bag['id'],'file_id':uploaded['id'],'label':'ورقة عمل إضافية','sort_order':0})
    updates=student.get('learning.updates')
    check(updates['total']==8 and updates['unread']==8,'Every new lesson, assignment, quiz, class, announcement, file, bag and attached bag item creates a learning notification')
    check(all(x['course_id']=='course' and x['link_path'].startswith('/') for x in updates['items']),'Notifications carry the correct course and a local content link')
    check(outsider.get('learning.updates')['total']==0,'Students outside the course cannot see its notifications')
    teacher.get('learning.updates',403);other.post('lesson.save',lesson,403)
    student.get('learning.updates.read',405);student.post('learning.updates.read',{'all':True},403,{'X-CSRF-Token':'bad'})
    check(True,'Notification reads require student ownership, the correct HTTP method and CSRF protection')
    nid=updates['items'][0]['id'];student.post('learning.updates.read',{'id':nid});student.post('learning.updates.read',{'id':nid})
    check(student.get('learning.updates')['unread']==7 and second.get('learning.updates')['unread']==8,'Read receipts persist independently per student and repeated reads are idempotent')
    outsider.post('learning.updates.read',{'id':nid},404)
    student.post('learning.updates.read',{'all':True})
    check(student.get('learning.updates')['unread']==0 and second.get('learning.updates')['unread']==8,'Read all affects only the requesting student')
    teacher.post('lesson.save',{**lesson,'id':lid,'body':'شرح محدّث'})
    check(student.get('learning.updates')['total']==8,'Editing a lesson does not duplicate its creation notification')
    teacher.post('lesson.save',{**lesson,'course_id':'draft'})
    check(not s.sql("SELECT id FROM learning_updates WHERE course_id='draft'"),'Draft-course content is never announced to students')
    teacher.post('quiz.save',{**quiz,'questions':[{'text':'سؤال','options':['','ب'],'correct':0}]},422)
    check(student.get('learning.updates')['total']==8,'Rejected content does not leave a notification')
    s.sql("UPDATE courses SET status='draft' WHERE id='course'")
    check(student.get('learning.updates')['total']==0,'Unpublishing a course immediately removes its notification visibility')
    s.sql("UPDATE courses SET status='published' WHERE id='course'")
    s.sql('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',['new-enroll','course','newcomer',stamp(1)])
    check(s.login('newcomer').get('learning.updates')['total']==0,'New enrollments do not receive a backlog of older content notifications')
    s.php(['-r', "require 'server/api.php';tx(function(){for($i=0;$i<30;$i++)courseUpdate('course','lesson','page-'.$i,'تحديث محاكاة','/courses/course');});"])
    first=student.get('learning.updates');last=student.get('learning.updates&page=2')
    check(first['total']==38 and len(first['items'])==25 and len(last['items'])==13 and not ({x['id'] for x in first['items']} & {x['id'] for x in last['items']}),'Notification pagination includes every item once with accurate unread totals')
    # Polling checks active authorization but does not extend the session idle timeout.
    sid=next(c.value for c in student.jar if c.name=='tafaseel_learn_local')
    s.php(['-r', "require 'server/api.php';session_save_path(cfg()['storage'].'/sessions');session_name('tafaseel_learn_local');session_id($argv[1]);session_start();$_SESSION['last']=time()-100;echo $_SESSION['last'];",sid])
    before=s.php(['-r', "require 'server/api.php';session_save_path(cfg()['storage'].'/sessions');session_name('tafaseel_learn_local');session_id($argv[1]);session_start();echo $_SESSION['last'];",sid]).stdout
    student.get('learning.updates')
    after=s.php(['-r', "require 'server/api.php';session_save_path(cfg()['storage'].'/sessions');session_name('tafaseel_learn_local');session_id($argv[1]);session_start();echo $_SESSION['last'];",sid]).stdout
    check(before==after,'Background notification polling does not keep an idle session alive')
    # No future/short/unauthorized class can start an automatic absence timer.
    student.post('class.attendance.control',{'class_id':cid,'command':'start'},403)
    other.post('class.attendance.control',{'class_id':cid,'command':'start'},403)
    check(True,'Only the assigned instructor or administrator can operate attendance automation')
    teacher.post('class.attendance.control',{'class_id':cid,'command':'start','mode':'manual'})
    start=s.sql('SELECT started_at FROM class_attendance_automation WHERE class_id=?',[cid])[0]['started_at']
    teacher.post('class.attendance.control',{'class_id':cid,'command':'start','mode':'manual'})
    check(s.sql('SELECT started_at FROM class_attendance_automation WHERE class_id=?',[cid])[0]['started_at']==start,'Repeated start clicks preserve the original twenty-minute deadline')
    early=json.loads(s.php(['server/console.php','worker']).stdout)
    check(early['attendance']['absent']==0 and len(SMS.messages)==0,'No automatic absence or guardian SMS is generated before the twenty-minute deadline')
    teacher.post('attendance.save',{'class_id':cid,'records':[{'student_id':'student','status':'present'},{'student_id':'third','status':'excused'}]})
    s.sql('UPDATE classes SET starts_at=? WHERE id=?',[stamp(-1201),cid]);s.sql('UPDATE class_attendance_automation SET started_at=? WHERE class_id=?',[stamp(-1201),cid])
    result=json.loads(s.php(['server/console.php','worker']).stdout)
    recorded=s.sql('SELECT student_id,status FROM attendance WHERE class_id=?',[cid]);statuses={x['student_id']:x['status'] for x in recorded}
    check(result['attendance']['absent']==1 and statuses=={'student':'present','third':'excused','second':'absent'},'At twenty minutes only an active, enrolled, unrecorded student is marked absent; present, excused, inactive and later enrollments are preserved')
    check(result['accepted']==1 and len(SMS.messages)==1 and SMS.messages[0]['recipients']==['966500000001'],'The same scheduled worker sends one official guardian SMS through the loopback provider')
    stored=s.sql('SELECT recipient,body,kind,status FROM notification_outbox WHERE class_id=?',[cid])[0]
    check('966500000001' not in stored['recipient'] and 'مركز تفاصيل' not in stored['body'] and stored['kind']=='absence_auto' and stored['status']=='accepted','Guardian phone and message body are encrypted and provider acceptance is recorded accurately')
    s.php(['server/console.php','worker'])
    check(len(SMS.messages)==1 and len(s.sql('SELECT id FROM notification_outbox WHERE class_id=?',[cid]))==1,'Worker retries never duplicate an already accepted absence message')
    details=teacher.get('data')['classes'];rule=next(c for c in details if c['id']==cid)['attendance_automation']
    check(rule['grace_minutes']==20 and rule['deadline'] and 'needs_review' in rule,'Instructor sees the configured attendance source and actual deadline')
    check('needs_review' not in next(c for c in student.get('data')['classes'] if c['id']==cid)['attendance_automation'],'Students receive timing information without operational review details')
    # Prepare a second class, hold the due message, then correct the attendance before dispatch.
    def due_class(title):
        c=teacher.post('class.save',{**class_body,'title':title,'starts_at':stamp(-1300)})['id']
        teacher.post('class.attendance.control',{'class_id':c,'command':'start','mode':'manual'})
        s.sql('UPDATE class_attendance_automation SET started_at=? WHERE class_id=?',[stamp(-1201),c])
        return c
    c2=due_class('حصة تصحيح الحضور');s.php(['-r',"require 'server/api.php';echo json_encode(automaticAbsences());"])
    teacher.post('attendance.save',{'class_id':c2,'records':[{'student_id':'second','status':'late','note':'حضر الطالب وتم التحقق'}]})
    check(s.sql('SELECT status FROM notification_outbox WHERE class_id=? AND student_id=?',[c2,'second'])[0]['status']=='cancelled','Correcting an automatic absence to late cancels its pending guardian SMS')
    teacher.post('class.attendance.control',{'class_id':c2,'command':'pause'})
    check(all(n['status']=='cancelled' for n in s.sql('SELECT status FROM notification_outbox WHERE class_id=?',[c2])),'Pausing a class cancels all unsubmitted automatic absence messages')
    c3=due_class('حصة عدم الاشتراك');s.sql("UPDATE guardian_preferences SET sms_enabled=0 WHERE student_id='second'")
    s.sql("UPDATE profiles SET guardian_phone='' WHERE user_id='third'")
    s.php(['-r',"require 'server/api.php';automaticAbsences();"])
    check(not s.sql("SELECT id FROM notification_outbox WHERE class_id=? AND student_id IN ('second','third')",[c3]),'Missing guardian phones and disabled SMS preferences cannot create outbound messages')
    teacher.post('class.attendance.control',{'class_id':c3,'command':'pause'})
    # Actual signed Zoom lifecycle events, with fail-closed handling of unmatched participants.
    zc=teacher.post('class.save',{**class_body,'title':'حصة زوم','starts_at':stamp(-1300),'attendance_mode':'zoom'})['id']
    s.php(['-r',"require 'server/api.php';run('INSERT INTO zoom_meetings(class_id,meeting_id,host_id,join_url,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[$argv[1],'91234567890','instructor@example.test',enc('https://center.zoom.us/j/91234567890'),'ready',now(),now()]);",zc])
    def webhook(event,extra):
        payload={'event':event,'event_ts':int(time.time()*1000),'payload':{'object':{'id':'91234567890','start_time':stamp(-1300),**extra}}}
        raw=json.dumps(payload,ensure_ascii=False).encode();ts=str(int(time.time()));sig='v0='+hmac.new(b'local-webhook',b'v0:'+ts.encode()+b':'+raw,hashlib.sha256).hexdigest()
        headers={'X-Zm-Request-Timestamp':ts,'X-Zm-Signature':sig}
        return teacher.post('zoom.webhook',payload,headers=headers)
    webhook('meeting.started',{})
    check(bool(s.sql('SELECT started_at FROM class_attendance_automation WHERE class_id=?',[zc])[0]['started_at']),'Verified Zoom meeting start begins the attendance deadline automatically')
    webhook('meeting.participant_joined',{'participant':{'email':'student@example.test','join_time':stamp(-1250)}})
    check(s.sql('SELECT status FROM attendance WHERE class_id=? AND student_id=?',[zc,'student'])[0]['status']=='present','Verified Zoom join records the enrolled student as present')
    webhook('meeting.participant_joined',{'participant':{'user_name':'Unidentified guest','join_time':stamp(-1240)}})
    out=json.loads(s.php(['-r',"require 'server/api.php';echo json_encode(automaticAbsences());"]).stdout)
    check(s.sql('SELECT needs_review FROM class_attendance_automation WHERE class_id=?',[zc])[0]['needs_review']==1 and not s.sql("SELECT id FROM attendance WHERE class_id=? AND status='absent'",[zc]),'Unmatched Zoom identities halt automatic absence decisions for instructor review')
    teacher.post('class.attendance.control',{'class_id':zc,'command':'pause'})
    # A known late join repairs only an automatic mark, never an instructor override.
    s.sql('UPDATE class_attendance_automation SET enabled=1,needs_review=0 WHERE class_id=?',[zc]);s.sql("UPDATE guardian_preferences SET sms_enabled=1 WHERE student_id='second'")
    s.php(['-r',"require 'server/api.php';automaticAbsences();"])
    webhook('meeting.participant_joined',{'participant':{'email':'second@example.test','join_time':stamp()}})
    check(s.sql('SELECT status FROM attendance WHERE class_id=? AND student_id=?',[zc,'second'])[0]['status']=='late','A verified late Zoom join repairs an automatic absence')
    check(s.sql('SELECT status FROM notification_outbox WHERE class_id=? AND student_id=?',[zc,'second'])[0]['status']=='cancelled','Late Zoom arrival cancels an unsent automatic guardian SMS')
    teacher.post('attendance.save',{'class_id':zc,'records':[{'student_id':'third','status':'excused','note':'عذر مقبول من الإدارة'}]})
    webhook('meeting.participant_joined',{'participant':{'email':'third@example.test','join_time':stamp()}})
    check(s.sql('SELECT status FROM attendance WHERE class_id=? AND student_id=?',[zc,'third'])[0]['status']=='excused','Zoom events preserve explicit instructor attendance decisions')
    expired=teacher.post('class.save',{**class_body,'automatic_absence':False,'starts_at':stamp(-10800),'ends_at':stamp(-7200)})['id']
    teacher.post('attendance.save',{'class_id':expired,'records':[{'student_id':'second','status':'absent'}]})
    s.sql('UPDATE notification_outbox SET next_attempt_at=? WHERE class_id=?',[stamp(-1),expired])
    s.php(['server/console.php','worker'])
    check(s.sql('SELECT status,error_code FROM notification_outbox WHERE class_id=?',[expired])[0]=={'status':'cancelled','error_code':'absence_expired'},'Old blocked absence messages expire instead of being sent days after connecting the provider')
    with Sandbox() as fresh:
        fresh.php(['-r', "require 'server/api.php';$hash=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);foreach(['admin','instructor','student'] as $id)run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$hash,$id,'2020-01-01T00:00:00Z']);run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES(?,?,?,?,?,?,?,?)',['course','دورة اختبار','محتوى مستقل','تدريب','/images/courses/foundation.webp','published','instructor',now()]);run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',['enroll','course','student','2020-01-01T00:00:00Z']);run('INSERT INTO profiles(user_id,guardian_phone,consent_at) VALUES(?,?,?)',['student',enc('+966500000001'),now()]);run('INSERT INTO guardian_preferences(student_id,sms_enabled,consent_at,updated_by,updated_at) VALUES(?,1,?,?,?)',['student',now(),'admin',now()]);"])
        local_teacher=fresh.login('instructor')
        blocked=local_teacher.post('class.save',{**class_body,'attendance_mode':'zoom'},422)
        check('ربط حساب زوم' in blocked['error'],'Unconfigured Zoom cannot be presented as an active attendance source')
        c4=local_teacher.post('class.save',{**class_body,'starts_at':stamp(-1300)})['id']
        local_teacher.post('class.attendance.control',{'class_id':c4,'command':'start','mode':'manual'})
        fresh.sql('UPDATE class_attendance_automation SET started_at=? WHERE class_id=?',[stamp(-1201),c4])
        fresh.php(['-r',"require 'server/api.php';automaticAbsences();"])
        check(fresh.sql('SELECT status FROM notification_outbox WHERE class_id=?',[c4])[0]['status']=='blocked','Unconfigured SMS is held as blocked without making an external request or claiming delivery')
    check(len(SMS.messages)==1,'All automated SMS test traffic stayed inside the isolated loopback receiver')
    report={'database':'MariaDB' if s.mysql else 'SQLite','passed':len(checks),'failed':0,'checks':checks,'production_data_used':False,'external_messages_sent':False}
    (ROOT/'docs'/('learning-notifications-qa-mariadb.json' if s.mysql else 'learning-notifications-qa-sqlite.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('DONE '+str(len(checks))+' checks',flush=True)
finally:
    provider.shutdown();provider.server_close()
