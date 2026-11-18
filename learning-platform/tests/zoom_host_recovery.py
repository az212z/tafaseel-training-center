"""Authorized teacher uses the configured center host and recovers only definite failures."""
import base64, datetime, hashlib, hmac, http.server, json, threading, time
from sandbox import Sandbox, Client

class Receiver(http.server.BaseHTTPRequestHandler):
    calls=[]
    fail_next=True
    fail_get=True
    def log_message(self,*args): pass
    def reply(self,status,data):
        raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path!='/zoom/meetings/91000000001':
            return self.reply(404, {})
        if Receiver.fail_get:
            Receiver.fail_get=False
            return self.reply(401, {})
        self.reply(200,{'password':'class-code','start_url':'https://center.zoom.us/s/91000000001?zak=test-host-access'})
    def do_POST(self):
        body=self.rfile.read(int(self.headers.get('Content-Length',0)))
        self.calls.append(self.path)
        if self.path=='/auth/oauth/token':
            status=200;data={'access_token':'isolated-token','expires_in':3600}
        elif self.path=='/zoom/users/center%40example.test/meetings':
            status=404 if self.fail_next else 201
            Receiver.fail_next=False
            data={'code':1001,'message':'user missing'} if status==404 else {
                'id':91000000001,'join_url':'https://center.zoom.us/j/91000000001?pwd=testing',
            }
        else: status=400;data={'message':'Wrong host'}
        self.reply(status,data)

receiver=http.server.ThreadingHTTPServer(('127.0.0.1',0),Receiver)
threading.Thread(target=receiver.serve_forever,daemon=True).start()
url='http://127.0.0.1:'+str(receiver.server_port)
try:
    with Sandbox(config_overrides={'test_provider_urls':{'zoom':url+'/zoom','zoom_auth':url+'/auth'},
        'integrations':{'zoom':{'enabled':True,'account_id':'isolated','client_id':'test','client_secret':'test',
                               'webhook_secret':'test','default_host':'center@example.test',
                               'sdk_client_id':'embedded-app','sdk_client_secret':'embedded-secret'}}}) as s:
        s.php(['-r',"""require 'server/api.php';$h=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);
        run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',['admin','إدارة','admin@example.test',$h,'admin',now()]);
        run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',['instructor','معلم','instructor@example.test',$h,'instructor',now()]);
        foreach (['student','unrelated'] as $id) {
            run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$h,'student',now()]);
        }
        run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES(?,?,?,?,?,?,?,?)',['course','دورة','تطبيق','عام','/test.webp','published','instructor',now()]);
        run('INSERT INTO enrollments(id,student_id,course_id,created_at) VALUES(?,?,?,?)',['enrollment','student','course',now()]);
        """])
        teacher=s.login('instructor')
        student=s.login('student')
        unrelated=s.login('unrelated')
        admin=s.login('admin')
        guest=Client(s.base)
        stamp=lambda x:(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=x)).strftime('%Y-%m-%dT%H:%M:%SZ')
        cid=teacher.post('class.save',{'course_id':'course','title':'حصة تجريبية','location':'عن بُعد',
                                     'starts_at':stamp(-30),'ends_at':stamp(1800),
                                     'automatic_absence':True,'attendance_mode':'zoom'})['id']
        teacher.post('zoom.create',{'class_id':cid,'host_email':'unassigned@example.test'},502)
        assert s.sql('SELECT status FROM zoom_meetings')[0]['status']=='failed'
        assert student.get('data')['classes'][0]['zoom_status'] is None
        teacher.post('zoom.create',{'class_id':cid,'host_email':'unassigned@example.test'})
        teacher.post('zoom.create',{'class_id':cid})
        assert s.sql('SELECT status,host_id FROM zoom_meetings')[0]=={'status':'ready','host_id':'center@example.test'}
        assert len([path for path in Receiver.calls if '/users/' in path])==2
        host=teacher.post('zoom.embed',{'class_id':cid, 'host':True})
        join=student.post('zoom.embed',{'class_id':cid})
        assert Receiver.calls.count('/auth/oauth/token')==2
        assert host['zak']=='test-host-access' and 'zak' not in join
        assert join['passWord']=='class-code' and len(join['customerKey'])==34
        header,payload,signature=join['signature'].split('.')
        claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
        assert claims['appKey']=='embedded-app' and claims['role']==0 and claims['mn']==join['meetingNumber']
        expected=hmac.new(b'embedded-secret',f'{header}.{payload}'.encode(),hashlib.sha256).digest()
        assert base64.urlsafe_b64decode(signature+'=')==expected
        unrelated.post('zoom.embed',{'class_id':cid},403)
        student.post('zoom.embed',{'class_id':cid,'host':True},403)
        assert not s.sql('SELECT id FROM zoom_presence')
        def event(name, **object_values):
            payload={'event':name,'payload':{'object':{'id':join['meetingNumber'],**object_values}}}
            raw=json.dumps(payload,ensure_ascii=False)
            ts=str(int(time.time()))
            signed=hmac.new(b'test',f'v0:{ts}:{raw}'.encode(),hashlib.sha256).hexdigest()
            return guest.post('zoom.webhook',payload,headers={
                'X-Zm-Request-Timestamp':ts,'X-Zm-Signature':'v0='+signed,
                'X-CSRF-Token':'','Origin':''})
        joined=stamp(-10)
        left=stamp(-2)
        event('meeting.started',start_time=stamp(-20))
        event('meeting.participant_joined',participant={'customer_key':join['customerKey'],'join_time':joined})
        event('meeting.participant_left',participant={'customer_key':join['customerKey'],'join_time':joined,'leave_time':left})
        assert s.sql('SELECT student_id,joined_at,left_at FROM zoom_presence')==[{'student_id':'student','joined_at':joined,'left_at':left}]
        assert s.sql('SELECT status FROM attendance')[0]['status']=='present'
        event('meeting.participant_joined',participant={'customer_key':'tf'+'1'*32,'email':'student@example.test','join_time':stamp(-8)})
        assert len(s.sql('SELECT id FROM zoom_presence'))==1
        admin.post('trash.remove',{'kind':'class','id':cid})
        event('meeting.ended',end_time=stamp(0))
        admin.post('trash.restore',{'kind':'class','id':cid})
        print('PASS embedded role-bound JWT, host-only ZAK, stale token refresh, signed join and leave, and archived-class callback')
        s.sql("UPDATE zoom_meetings SET status='uncertain',meeting_id=NULL")
        teacher.post('zoom.create',{'class_id':cid},409)
        assert len([path for path in Receiver.calls if '/users/' in path])==2
        print('PASS configured center host, definite-failure retry, duplicate prevention and uncertain-request protection')
finally:
    receiver.shutdown();receiver.server_close()
