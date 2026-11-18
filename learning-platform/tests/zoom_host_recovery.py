"""Authorized teacher uses the configured center host and recovers only definite failures."""
import datetime, http.server, json, threading
from sandbox import Sandbox, ROOT

class Receiver(http.server.BaseHTTPRequestHandler):
    calls=[]
    fail_next=True
    def log_message(self,*args): pass
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
        raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)

receiver=http.server.ThreadingHTTPServer(('127.0.0.1',0),Receiver)
threading.Thread(target=receiver.serve_forever,daemon=True).start()
url='http://127.0.0.1:'+str(receiver.server_port)
try:
    with Sandbox(config_overrides={'test_provider_urls':{'zoom':url+'/zoom','zoom_auth':url+'/auth'},
        'integrations':{'zoom':{'enabled':True,'account_id':'isolated','client_id':'test','client_secret':'test',
                               'webhook_secret':'test','default_host':'center@example.test'}}}) as s:
        s.php(['-r',"""require 'server/api.php';$h=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);
        run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',['instructor','معلم','instructor@example.test',$h,'instructor',now()]);
        run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES(?,?,?,?,?,?,?,?)',['course','دورة','تطبيق','عام','/test.webp','published','instructor',now()]);
        """])
        teacher=s.login('instructor')
        stamp=lambda x:(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=x)).strftime('%Y-%m-%dT%H:%M:%SZ')
        cid=teacher.post('class.save',{'course_id':'course','title':'حصة تجريبية','location':'عن بُعد',
                                     'starts_at':stamp(-30),'ends_at':stamp(1800)})['id']
        teacher.post('zoom.create',{'class_id':cid,'host_email':'unassigned@example.test'},502)
        assert s.sql('SELECT status FROM zoom_meetings')[0]['status']=='failed'
        teacher.post('zoom.create',{'class_id':cid,'host_email':'unassigned@example.test'})
        teacher.post('zoom.create',{'class_id':cid})
        assert s.sql('SELECT status,host_id FROM zoom_meetings')[0]=={'status':'ready','host_id':'center@example.test'}
        assert len([path for path in Receiver.calls if '/users/' in path])==2
        s.sql("UPDATE zoom_meetings SET status='uncertain',meeting_id=NULL")
        teacher.post('zoom.create',{'class_id':cid},409)
        assert len([path for path in Receiver.calls if '/users/' in path])==2
        print('PASS configured center host, definite-failure retry, duplicate prevention and uncertain-request protection')
finally:
    receiver.shutdown();receiver.server_close()
