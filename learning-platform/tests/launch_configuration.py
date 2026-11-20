"""Private service settings, queue capacity and delivery priority; loopback receivers only."""
import concurrent.futures, datetime, email, email.policy, http.server, json, socketserver, threading, time
from sandbox import Sandbox, ROOT

checks=[]
def check(value,label):
    assert value,label
    checks.append(label);print('PASS '+label,flush=True)
def stamp(seconds=0):return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)).strftime('%Y-%m-%dT%H:%M:%SZ')

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

class SMS(http.server.BaseHTTPRequestHandler):
    messages=[];active=0;peak=0;lock=threading.Lock();reject={}
    def log_message(self,*a):pass
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        with self.lock:
            SMS.active+=1;SMS.peak=max(SMS.peak,SMS.active);SMS.messages.append(data);message=len(SMS.messages)
        time.sleep(.03)
        code=self.reject.get(data['recipients'][0],201)
        body=json.dumps({'statusCode':code,'messageId':message}).encode()
        self.send_response(200 if code==201 else code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        with self.lock:SMS.active-=1

smtp=socketserver.ThreadingTCPServer(('127.0.0.1',0),SMTP)
sms=http.server.ThreadingHTTPServer(('127.0.0.1',0),SMS)
for receiver in [smtp,sms]:threading.Thread(target=receiver.serve_forever,daemon=True).start()
try:
  with Sandbox(smtp_port=smtp.server_address[1],config_overrides={'test_provider_urls':{'sms':'http://127.0.0.1:'+str(sms.server_port)+'/sms'},'integrations':{'sms':{'enabled':True,'token':'loopback-sms-only','sender':'TEST'}}}) as s:
    s.php(['-r', "require 'server/api.php';$hash=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);foreach(['admin'=>'admin','instructor'=>'instructor','student'=>'student'] as $id=>$role)run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$hash,$role,now()]);run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,capacity,created_at) VALUES(?,?,?,?,?,?,?,?,?)',['course','دورة السعة','محتوى معزول','عام','','published','instructor',500,now()]);for($i=0;$i<200;$i++){$id='s'.$i;run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$hash,'student',now()]);run('INSERT INTO profiles(user_id,guardian_phone,consent_at) VALUES(?,?,?)',[$id,enc('+966500'.str_pad((string)$i,6,'0',STR_PAD_LEFT)),now()]);run('INSERT INTO guardian_preferences(student_id,sms_enabled,consent_at,updated_by,updated_at) VALUES(?,1,?,?,?)',[$id,now(),'admin',now()]);run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',[uid(),'course',$id,'2020-01-01T00:00:00Z']);}"])
    admin=s.login('admin');teacher=s.login('instructor');student=s.login('student')
    for client in [teacher,student]:client.get('services.connections',403);client.get('delivery.status',403)
    status=admin.get('services.connections')
    check(len(status['items'])==4 and status['zoom_webhook_url'].endswith('action=zoom.webhook'),'Private service setup is administrator-only and shows the actual Zoom event endpoint')
    values={
      'moyasar':{'mode':'test','secret_key':'sk_test_local_secret_123456'},
      'zoom':{'account_id':'local-account','client_id':'local-client','client_secret':'local-secret-1234','webhook_secret':'local-webhook-1234','default_host':'instructor@example.test'},
      'video':{'library_id':'12345','api_key':'local-video-secret-1234','token_key':'local-player-secret-1234'},
      's3':{'bucket':'tafaseel-private-test','region':'eu-central-1','access_key':'local-access-1234','secret_key':'local-storage-secret-1234'},
    }
    admin.post('services.connection.save',{'service':'moyasar','enabled':True,'values':values['moyasar'],'current_password':'incorrect'},422)
    for name,fields in values.items():
        result=admin.post('services.connection.save',{'service':name,'enabled':True,'values':fields,'current_password':s.password})
        stored=s.sql('SELECT value FROM settings WHERE setting_key=?',['service_connection_'+name])[0]['value']
        secret=next(v for k,v in fields.items() if k in ['secret_key','client_secret','api_key'])
        check(result['configured'] and secret not in stored and secret not in json.dumps(admin.get('services.connections')),'Service '+name+' credentials are encrypted and never returned to the browser')
    admin.post('services.connection.save',{'service':'moyasar','enabled':True,'values':{'mode':'live','secret_key':''},'current_password':s.password},422)
    retained=admin.post('services.connection.save',{'service':'moyasar','enabled':True,'values':{'mode':'test','secret_key':''},'current_password':s.password})
    check(retained['configured'],'Keeping a saved secret does not expose it and a test key cannot enable live payment mode')
    admin.post('email.configure',{'address':'admin@tafaseel-learn.com','name':'تفاصيل','port':465,'daily_limit':80,'password':'Loopback-Mail-Only','enabled':True,'current':s.password})
    limits={'mail_plan':'starter','mail_daily_limit':600,'mail_per_minute':20,'mail_reserved_percent':25,'sms_per_minute':200,'sms_parallel':4,'limits_confirmed':True,'current_password':s.password}
    admin.post('delivery.configure',{**limits,'current_password':'incorrect'},422)
    admin.post('delivery.configure',{**limits,'limits_confirmed':False},422)
    admin.post('delivery.configure',{**limits,'mail_plan':'free','mail_daily_limit':81},422)
    status=admin.post('delivery.configure',limits)
    check(status['mail_daily_limit']==600 and status['limits']['mail_daily_ceiling']==900,'Higher mail capacity requires administrator reauthentication, confirmed provider limits and a matching plan ceiling')
    mail=admin.get('email.status')
    check(mail['configured'] and mail['has_password'] and mail['daily_limit']==600 and 'password' not in mail,'Changing delivery capacity preserves the existing encrypted SMTP connection')
    s.sql('DELETE FROM rate_limits')
    s.php(['-r', "require 'server/api.php';saveEmailPreference('s0',true,true);for($i=0;$i<6;$i++)queueEmail('marketing-'.$i,'s0','marketing','نشرة اختبار','نشرة اختيارية');queueEmail('important-account','s0','account','رسالة حساب مهمة','أكمل تفعيل حسابك.');for($i=0;$i<450;$i++){$id='history-'.$i;run(\"INSERT INTO email_outbox(id,dedupe_key,user_id,kind,recipient,subject,body,link_path,status,next_attempt_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)\",[$id,$id,'s0','training',enc('s0@example.test'),enc('رسالة سابقة'),enc('محتوى سابق'),'/dashboard','accepted',now(),now(),now()]);run('INSERT INTO email_attempts(id,message_id,created_at) VALUES(?,?,?)',[$id,$id,gmdate('Y-m-d\\TH:i:s\\Z',time()-120)]);}"])
    result=json.loads(s.php(['server/console.php','worker','email']).stdout)['email']
    check(result['accepted']==1 and result['deferred']==6 and len(SMTP.messages)==1 and str(SMTP.messages[0]['Subject'])=='رسالة حساب مهمة','Account mail is delivered ahead of campaigns while the reserved daily quota prevents campaigns from consuming its allowance')
    late=s.sql("SELECT COUNT(*) n FROM email_outbox WHERE kind='marketing' AND next_attempt_at>?",[stamp(60)])[0]['n']
    check(late==6,'Quota-deferred campaign mail is rescheduled instead of repeatedly blocking the ready queue')
    session=teacher.post('class.save',{'course_id':'course','title':'دفعة رسائل معزولة','starts_at':stamp(-1300),'ends_at':stamp(3600),'location':'اختبار فقط','automatic_absence':True,'attendance_mode':'manual'})['id']
    teacher.post('class.attendance.control',{'class_id':session,'command':'start','mode':'manual'})
    s.sql('UPDATE class_attendance_automation SET started_at=? WHERE class_id=?',[stamp(-1201),session])
    start=time.perf_counter();result=json.loads(s.php(['server/console.php','worker','sms']).stdout);duration=time.perf_counter()-start
    check(result['attendance']['absent']==200 and result['accepted']==200 and len(SMS.messages)==200,'One minute worker processes two hundred eligible guardian notices instead of the former fixed twenty-five limit')
    check(2<=SMS.peak<=4 and len({x['recipients'][0] for x in SMS.messages})==200,'Bounded parallel delivery uses at most four active requests and preserves every recipient without duplication')
    s.php(['server/console.php','worker','sms'])
    check(len(SMS.messages)==200,'Repeated worker runs do not resend accepted burst notices')
    def manual_class(label,count):
        cid=teacher.post('class.save',{'course_id':'course','title':label,'starts_at':stamp(-1300),'ends_at':stamp(3600),'location':'اختبار معزول'})['id']
        teacher.post('attendance.save',{'class_id':cid,'records':[{'student_id':'s'+str(i),'status':'absent'} for i in range(count)]})
        s.sql('UPDATE notification_outbox SET next_attempt_at=? WHERE class_id=?',[stamp(-1),cid]);return cid
    extra=manual_class('اختبار حد الدقيقة',3)
    result=json.loads(s.php(['server/console.php','worker','sms']).stdout)
    check(result['accepted']==0 and result['deferred']==3 and len(SMS.messages)==200,'The rolling minute quota applies even when another worker run starts immediately')
    s.sql('DELETE FROM sms_attempts');s.sql('UPDATE notification_outbox SET next_attempt_at=? WHERE class_id=?',[stamp(-1),extra])
    admin.post('delivery.configure',{**limits,'sms_per_minute':3})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:json.loads(s.php(['server/console.php','worker','sms']).stdout),range(2)))
    check(sum(x['accepted'] for x in results)==3 and len(SMS.messages)==203,'Two concurrent workers atomically share the SMS quota and never send the same notice twice')
    s.sql('DELETE FROM sms_attempts');mixed=manual_class('اختبار نتائج الدفعة',3)
    SMS.reject={'966500000001':429,'966500000002':503}
    result=json.loads(s.php(['server/console.php','worker','sms']).stdout)
    check(result['accepted']==1 and result['retry']==1 and result['uncertain']==1,'Parallel delivery records acceptance, safe retry and uncertain outcomes separately for each recipient')
    admin_status=admin.get('delivery.status')
    check(admin_status['queues']['sms']['waiting']>=1 and admin_status['sms_estimated_minutes'] is not None and 'token' not in json.dumps(admin_status),'Administrator queue monitoring reports waiting work and a qualified estimate without returning provider secrets')
    report={'database':'MariaDB' if s.mysql else 'SQLite','passed':len(checks),'failed':0,'checks':checks,'sms_burst':{'accepted':200,'seconds':round(duration,3),'peak_parallel':SMS.peak},'external_delivery':False,'production_data_used':False}
    (ROOT/'output'/('launch-configuration-'+report['database'].lower()+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('DONE '+str(len(checks))+' checks')
finally:
    smtp.shutdown();smtp.server_close();sms.shutdown();sms.server_close()
