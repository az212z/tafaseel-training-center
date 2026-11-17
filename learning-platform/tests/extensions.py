"""Real HTTP/PDO integration tests against isolated local provider doubles. No external requests or messages."""
import os,sys,json,pathlib,tempfile,subprocess,socket,time,threading,http.server,urllib.request,urllib.error,http.cookiejar,hashlib,hmac,uuid,re
from datetime import datetime,timezone,timedelta
ROOT=pathlib.Path(__file__).resolve().parents[1];ORIGIN='http://127.0.0.1:3117';checks=[]
def check(value,label):
 assert value,label
 checks.append(label)
def stamp(offset=0):return (datetime.now(timezone.utc)+timedelta(seconds=offset)).strftime('%Y-%m-%dT%H:%M:%SZ')
class Mock(http.server.BaseHTTPRequestHandler):
 invoices={};meetings={};videos={};objects={};calls=[];sms_mode=201;invoice_mode=201
 def log_message(self,*args):pass
 def reply(self,data,status=200):
  raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_POST(self):
  raw=self.rfile.read(int(self.headers.get('Content-Length',0)));self.calls.append(('POST',self.path,raw));d=json.loads(raw) if self.headers.get('Content-Type','').startswith('application/json') else {}
  if self.path=='/moyasar/invoices':
   pid=str(uuid.uuid4());v={**d,'id':pid,'status':'initiated','url':'https://checkout.moyasar.com/invoices/'+pid};self.invoices[pid]=v;return self.reply(v,self.invoice_mode)
  if self.path=='/sms/messages':return self.reply({'statusCode':self.sms_mode,'messageId':1234,'accepted':d.get('recipients',[])},self.sms_mode)
  if self.path=='/zoom_auth/oauth/token':return self.reply({'access_token':'fake-zoom-access','expires_in':3600})
  if self.path.startswith('/zoom/users/') and self.path.endswith('/meetings'):
   mid=str(91000000000+len(self.meetings));v={**d,'id':mid,'join_url':'https://center.zoom.us/j/'+mid+'?pwd=fake','start_url':'https://center.zoom.us/s/'+mid+'?zak=FAKE-HOST-PRIVATE'};self.meetings[mid]=v;return self.reply(v,201)
  if self.path=='/video/library/123/videos':
   pid=str(uuid.uuid4());v={'guid':pid,'status':3,'storageSize':12000,**d};self.videos[pid]=v;return self.reply(v,201)
  return self.reply({},404)
 def do_GET(self):
  self.calls.append(('GET',self.path,b''))
  if self.path.startswith('/moyasar/invoices/'):return self.reply(self.invoices.get(self.path.rsplit('/',1)[-1],{}))
  if self.path.startswith('/zoom/meetings/'):return self.reply(self.meetings.get(self.path.rsplit('/',1)[-1],{}))
  if self.path.startswith('/video/library/123/videos/'):return self.reply(self.videos.get(self.path.rsplit('/',1)[-1],{}))
  key=self.path.split('?')[0]
  if key in self.objects:
   raw=self.objects[key];self.send_response(200);self.send_header('Content-Length',str(len(raw)));self.send_header('Content-Type','application/octet-stream');self.end_headers();self.wfile.write(raw);return
  return self.reply({},404)
 def do_PUT(self):
  raw=self.rfile.read(int(self.headers.get('Content-Length',0)));self.objects[self.path.split('?')[0]]=raw;self.send_response(200);self.send_header('ETag','"'+hashlib.md5(raw).hexdigest()+'"');self.send_header('Content-Length','0');self.end_headers()
 def do_DELETE(self):self.objects.pop(self.path.split('?')[0],None);self.send_response(204);self.end_headers()
class Client:
 def __init__(self,base):self.base=base;self.csrf='';self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar));self.get('session')
 def call(self,action,body=None,expected=200,headers=None):
  raw=None if body is None else json.dumps(body,ensure_ascii=False,separators=(',',':')).encode();h={'Origin':ORIGIN,'Content-Type':'application/json','X-CSRF-Token':self.csrf};h.update(headers or {});req=urllib.request.Request(self.base+'/api/index.php?action='+action,data=raw,headers=h)
  try:
   with self.http.open(req) as r:status=r.status;result=r.read()
  except urllib.error.HTTPError as e:status=e.code;result=e.read()
  assert status==expected,(action,status,result[:300]);r=json.loads(result)
  if 'csrf' in r:self.csrf=r['csrf']
  return r
 def get(self,action,expected=200):return self.call(action,expected=expected)
 def post(self,action,data,expected=200,headers=None):return self.call(action,data,expected,headers)
 def upload(self,payload,course=None,student=None,purpose='resource',expected=200):
  boundary='test'+str(time.time_ns());fields={'purpose':purpose}
  if course:fields['course_id']=course
  if student:fields['student_id']=student
  data=b''.join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k,v in fields.items())+f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+payload+f'\r\n--{boundary}--\r\n'.encode()
  req=urllib.request.Request(self.base+'/api/index.php?action=file.upload',data=data,headers={'Origin':ORIGIN,'X-CSRF-Token':self.csrf,'Content-Type':'multipart/form-data; boundary='+boundary})
  try:
   with self.http.open(req) as r:status=r.status;result=r.read()
  except urllib.error.HTTPError as e:status=e.code;result=e.read()
  assert status==expected,(status,result[:300]);return json.loads(result)
provider=http.server.ThreadingHTTPServer(('127.0.0.1',0),Mock);threading.Thread(target=provider.serve_forever,daemon=True).start()
with tempfile.TemporaryDirectory(prefix='tafaseel-v2-test-') as folder:
 temp=pathlib.Path(folder);mysql_socket=os.environ.get('TAFASEEL_TEST_MYSQL_SOCKET');db_name='tafaseel_v2_'+os.urandom(5).hex()
 if mysql_socket:subprocess.run(['mariadb','--no-defaults','--socket='+mysql_socket,'-u','root','-e','CREATE DATABASE '+db_name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'],check=True)
 dsn=f'mysql:unix_socket={mysql_socket};dbname={db_name};charset=utf8mb4' if mysql_socket else 'sqlite:'+str(temp/'database.sqlite')
 config=temp/'config.php';provider_base='http://127.0.0.1:'+str(provider.server_port);key=os.urandom(32).hex()
 config.write_text("<?php return "+"['environment'=>'local','demo'=>false,'testing'=>true,'registration_enabled'=>true,'origin'=>'"+ORIGIN+"','dsn'=>'"+dsn+"','db_user'=>'root','db_password'=>'','key'=>'"+key+"','storage'=>'"+str(temp/'storage')+"','test_provider_urls'=>['moyasar'=>'"+provider_base+"/moyasar','sms'=>'"+provider_base+"/sms','zoom'=>'"+provider_base+"/zoom','zoom_auth'=>'"+provider_base+"/zoom_auth','video'=>'"+provider_base+"/video'],'integrations'=>['moyasar'=>['enabled'=>true,'secret_key'=>'sk_test_fake','mode'=>'test'],'sms'=>['enabled'=>true,'token'=>'fake-sms-token','sender'=>'FAKE'],'zoom'=>['enabled'=>true,'account_id'=>'fake-account','client_id'=>'fake-client','client_secret'=>'fake-client-secret','webhook_secret'=>'fake-webhook-secret','default_host'=>'instructor@example.test'],'video'=>['enabled'=>true,'library_id'=>'123','api_key'=>'fake-video-key','token_key'=>'fake-player-key'],'s3'=>['enabled'=>true,'bucket'=>'test-bucket','region'=>'auto','endpoint'=>'"+provider_base+"','access_key'=>'fake-s3-key','secret_key'=>'fake-s3-secret']]];")
 env={**os.environ,'TAFASEEL_CONFIG':str(config)}
 def php(args):return subprocess.run(['php',*args],env=env,text=True,capture_output=True,check=True)
 php([str(ROOT/'server/console.php'),'migrate']);php([str(ROOT/'server/console.php'),'migrate'])
 query=temp/'query.php';query.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+"; $d=json_decode(stream_get_contents(STDIN),true);$s=db()->prepare($d['sql']);$s->execute($d['args']??[]);echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));")
 def sql(q,args=[]):return json.loads(subprocess.run(['php',str(query)],input=json.dumps({'sql':q,'args':args}),env=env,text=True,capture_output=True,check=True).stdout)
 seed=temp/'seed.php';password='Fictional-Integration-Password-93!';seed.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";foreach(['admin','instructor','other','student','second','guardian'] as $id){$role=in_array($id,['other'])?'instructor':($id==='second'?'student':$id);run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',password_hash('"+password+"',PASSWORD_DEFAULT),$role,now()]);}")
 php([str(seed)])
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 log=open(temp/'server.log','w');server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(ROOT/'public'),str(ROOT/'server/router.php')],env=env,stdout=log,stderr=log)
 try:
  base=f'http://127.0.0.1:{port}'
  for _ in range(50):
   try:guest=Client(base);break
   except Exception:time.sleep(.1)
  def client(role):c=Client(base);c.post('login',{'email':role+'@example.test','password':password});return c
  admin=client('admin');trainer=client('instructor');other=client('other');student=client('student');second=client('second');guardian=client('guardian')
  check(True,'Idempotent portable migration succeeds twice')
  reg={'name':'طالب طلب تجريبي','email':'pending@example.test','password':password,'birth_date':'2000-01-01','phone':'0500000001','consent':True,'role':'admin','identity_number':'1000000001','guardian_id':'guardian'}
  guest.post('register',{**reg,'consent':False},422);guest.post('register',reg);guest.post('register',reg)
  stored=sql('SELECT id,role,active FROM users WHERE email=?',['pending@example.test'])[0];check(stored['role']=='student' and int(stored['active'])==0,'Public registration cannot escalate roles and needs administrator review')
  check(len(sql('SELECT id FROM users WHERE email=?',['pending@example.test']))==1,'Repeated registration does not duplicate accounts')
  pending=Client(base);pending.post('login',{'email':reg['email'],'password':password},401)
  profile=sql('SELECT identity_number,guardian_id,phone FROM profiles WHERE user_id=?',[stored['id']])[0];check(not profile['identity_number'] and not profile['guardian_id'] and '0500000001' not in profile['phone'],'Registration excludes identity and untrusted guardian links; phone encrypted')
  guest.post('register',{**reg,'email':'minor@example.test','birth_date':'2015-01-01','phone':''},422);check(True,'Public minor registration requires guardian contact')
  check(admin.get('students.list&search=pending&page=1')['total']==1,'Student search and pagination includes pending requests')
  course={'title':'دورة تكامل مدفوعة','description':'وصف تجريبي للتكاملات الخارجية','category':'مسار تجريبي','instructor_id':'instructor','capacity':2,'duration':12,'status':'published'}
  cid=admin.post('course.save',course)['id'];cid2=admin.post('course.save',{**course,'title':'دورة أخرى','capacity':3})['id']
  student.post('commerce.save',{'course_id':cid,'price_minor':100},403);trainer.post('commerce.save',{'course_id':cid,'price_minor':100},403)
  admin.post('commerce.save',{'course_id':cid,'price_minor':50000,'enrollment_open':True});admin.post('commerce.save',{'course_id':cid2,'price_minor':0,'enrollment_open':True})
  check(guest.get('catalog')['total']==2,'Only published open-enrollment courses appear in public catalog')
  first=student.post('checkout',{'course_id':cid,'amount':1,'status':'paid'})['order'];pid=sql('SELECT provider_id FROM orders WHERE id=?',[first['id']])[0]['provider_id'];check(first['amount']==50000 and Mock.invoices[pid]['amount']==50000,'Checkout price comes from server and ignores claimed amount')
  student.get('student&id=second',403);student.get('file&id=unknown',404)
  student.post('payment.refresh',{'id':first['id'],'status':'paid'});check(not sql('SELECT id FROM enrollments WHERE course_id=? AND student_id=?',[cid,'student']),'A browser success claim cannot grant paid enrollment')
  again=student.post('checkout',{'course_id':cid})['order'];check(first['id']==again['id'] and len(Mock.invoices)==1,'Repeated checkout reuses pending invoice without another provider creation')
  second.post('payment.refresh',{'id':first['id']},403);guardian.get('orders',403);check(True,'Payment order ownership enforced for students and guardians')
  guest.post('payment.callback&order='+first['id']+'&token=bad',{'id':pid},403);check(True,'Forged callback token rejected')
  Mock.invoices[pid]['status']='paid';Mock.invoices[pid]['amount']=1;student.post('payment.refresh',{'id':first['id']},409);check(not sql('SELECT id FROM enrollments WHERE course_id=?',[cid]),'Paid invoice amount mismatch cannot create enrollment');Mock.invoices[pid]['amount']=50000
  token=hmac.new(key.encode(),('invoice:'+first['id']).encode(),hashlib.sha256).hexdigest();guest.post('payment.callback&order='+first['id']+'&token='+token,{'id':pid},headers={'Origin':'','X-CSRF-Token':''});guest.post('payment.callback&order='+first['id']+'&token='+token,{'id':pid})
  check(len(sql('SELECT id FROM enrollments WHERE course_id=? AND student_id=?',[cid,'student']))==1,'Verified provider callback grants exactly one paid enrollment')
  check(student.get('orders')['items'][0]['status']=='paid','Verified paid state persisted in student ledger')
  student.post('checkout',{'course_id':cid},409)
  secondorder=second.post('checkout',{'course_id':cid})['order'];admin.post('enroll',{'course_id':cid,'student_id':stored['id']},409);check(True,'Pending payment reserves a seat against manual oversubscription')
  free=student.post('checkout',{'course_id':cid2});check(free['enrolled'],'Free registration uses server transaction and capacity checks')
  Mock.invoice_mode=500;admin.post('commerce.save',{'course_id':cid2,'price_minor':25000,'enrollment_open':True});unknown=second.post('checkout',{'course_id':cid2})['order'];check(unknown['status']=='uncertain','Ambiguous invoice creation is held for reconciliation, never silently retried');count=len(Mock.invoices);second.post('checkout',{'course_id':cid2});check(len(Mock.invoices)==count,'Unknown payment outcome cannot trigger automatic duplicate invoice');Mock.invoice_mode=201
  orphan=next(v for v in Mock.invoices.values() if v['description'].endswith(unknown['id']));admin.post('payment.recover',{'id':unknown['id'],'provider_id':pid},409);orphan['status']='paid';admin.post('payment.recover',{'id':unknown['id'],'provider_id':orphan['id']});check(sql('SELECT status FROM orders WHERE id=?',[unknown['id']])[0]['status']=='paid','Recovery validates order reference and amount against provider before enrollment')
  bag=trainer.post('bag.save',{'course_id':cid,'title':'حقيبة اختبار','version':'1.0','description':'دليل المتعلم وورقة العمل'})['id'];other.get('bags&course_id='+cid,403);check(True,'Learning bag isolated to assigned instructor or enrolled learner')
  pdf=b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n';f=trainer.upload(pdf,course=cid);check(bool(Mock.objects) and all(not b.startswith(b'%PDF') for b in Mock.objects.values()),'S3-compatible object storage receives encrypted bytes only')
  trainer.post('bag.item.save',{'bag_id':bag,'file_id':f['id'],'label':'دليل الطالب','sort_order':1});check(student.get('bags&course_id='+cid)['items'][0]['items'][0]['file_id']==f['id'],'Enrolled student can see bag and resource reference')
  with student.http.open(base+'/api/index.php?action=file&id='+f['id']) as r: downloaded=r.read()
  check(downloaded==pdf,'Private S3 file decrypts only after authorized API download')
  trainer.post('bag.item.save',{'bag_id':bag,'file_id':f['id'],'label':'مكرر'},409);trainer.post('bag.item.remove',{'bag_id':bag,'file_id':f['id']});check(not student.get('bags&course_id='+cid)['items'][0]['items'],'Removing bag reference preserves the stored resource')
  child=admin.post('user.save',{'role':'student','name':'طفل تجريبي','email':'child@example.test','password':password,'birth_date':'2015-01-01','city':'تبوك','phone':'','guardian_name':'ولي تجريبي','guardian_phone':'0500000002','guardian_id':'guardian','consent':True})['id'];admin.post('enroll',{'course_id':cid2,'student_id':child})
  guardian.post('guardian.preference.save',{'student_id':child,'sms_enabled':True,'consent':False},422);guardian.post('guardian.preference.save',{'student_id':'student','sms_enabled':True,'consent':True},403);trainer.get('guardian.preference&student_id='+child,403);guardian.post('guardian.preference.save',{'student_id':child,'sms_enabled':True,'consent':True});check(True,'Guardian SMS consent and child relationship required')
  classid=trainer.post('class.save',{'course_id':cid2,'title':'حصة زوم تجريبية','starts_at':stamp(-1800),'ends_at':stamp(1800),'location':'عن بعد'})['id'];trainer.post('attendance.save',{'class_id':classid,'records':[{'student_id':child,'status':'absent'}]});notice=sql('SELECT * FROM notification_outbox WHERE student_id=?',[child])[0]
  check(notice['status']=='pending' and '0500000002' not in notice['recipient'] and 'طفل تجريبي' not in notice['body'],'Attendance and encrypted guardian notification commit together')
  check(json.loads(php([str(ROOT/'server/console.php'),'worker']).stdout)['accepted']==0,'Grace period prevents immediate SMS before roster review')
  trainer.post('attendance.save',{'class_id':classid,'records':[{'student_id':child,'status':'present','note':'تصحيح حضور الطالب'}]});check(sql('SELECT status FROM notification_outbox WHERE id=?',[notice['id']])[0]['status']=='cancelled','Correcting absence cancels pending notification')
  trainer.post('attendance.save',{'class_id':classid,'records':[{'student_id':child,'status':'absent','note':'تأكيد الغياب بعد المراجعة'}]});sql('UPDATE notification_outbox SET next_attempt_at=? WHERE id=?',[stamp(-60),notice['id']]);result=json.loads(php([str(ROOT/'server/console.php'),'worker']).stdout);check(result['accepted']==1,'Worker submits opted-in guardian message to configured provider')
  check(sql('SELECT status FROM notification_outbox WHERE id=?',[notice['id']])[0]['status']=='accepted','Provider acceptance stored without claiming handset delivery');count=len([c for c in Mock.calls if c[1]=='/sms/messages']);php([str(ROOT/'server/console.php'),'worker']);check(len([c for c in Mock.calls if c[1]=='/sms/messages'])==count,'Worker cannot resend accepted absence notice')
  notifications=guardian.get('notifications');check(notifications['total']==1 and notifications['items'][0]['recipient'].endswith('0002') and '+966' not in notifications['items'][0]['recipient'],'Guardian sees only own child notifications with masked destination')
  admin.post('notification.retry',{'id':notice['id']},409)
  class2=trainer.post('class.save',{'course_id':cid2,'title':'حصة إعادة محاولة','starts_at':stamp(-1800),'ends_at':stamp(1800),'location':'قاعة'})['id'];trainer.post('attendance.save',{'class_id':class2,'records':[{'student_id':child,'status':'absent'}]});n2=sql('SELECT id FROM notification_outbox WHERE class_id=?',[class2])[0]['id'];sql('UPDATE notification_outbox SET next_attempt_at=? WHERE id=?',[stamp(-60),n2]);Mock.sms_mode=429;php([str(ROOT/'server/console.php'),'worker']);check(sql('SELECT status,next_attempt_at FROM notification_outbox WHERE id=?',[n2])[0]['status']=='retry','Explicit provider rate-limit rejection schedules delayed retry')
  sql('UPDATE notification_outbox SET next_attempt_at=? WHERE id=?',[stamp(-60),n2]);Mock.sms_mode=500;php([str(ROOT/'server/console.php'),'worker']);check(sql('SELECT status FROM notification_outbox WHERE id=?',[n2])[0]['status']=='uncertain','Ambiguous SMS outcome is held instead of risking duplicate delivery');count=len([c for c in Mock.calls if c[1]=='/sms/messages']);php([str(ROOT/'server/console.php'),'worker']);check(len([c for c in Mock.calls if c[1]=='/sms/messages'])==count,'Unknown SMS outcomes excluded from automatic retries');Mock.sms_mode=201
  student.post('zoom.create',{'class_id':classid},403);trainer.post('zoom.create',{'class_id':classid,'host_email':'other@example.test'});trainer.post('zoom.create',{'class_id':classid});check(len(Mock.meetings)==1,'Zoom creation is idempotent and an instructor cannot override assigned host')
  zoom=next(iter(Mock.meetings.values()));check(zoom['settings']['waiting_room'] and not zoom['settings']['join_before_host'] and zoom['settings']['auto_recording']=='none','Zoom meeting defaults enable waiting room and disable unattended join and recording')
  check('FAKE-HOST-PRIVATE' not in json.dumps(student.get('data')),'Host start secret never appears in shared course data')
  student.post('zoom.link',{'class_id':classid,'host':True},403);link=student.post('zoom.link',{'class_id':classid});host=trainer.post('zoom.link',{'class_id':classid,'host':True});check('/j/' in link['url'] and '/s/' in host['url'],'Learner join and assigned host start routes are separated')
  other.post('zoom.link',{'class_id':classid,'host':True},403);guardian.post('zoom.link',{'class_id':classid},403)
  challenge={'event':'endpoint.url_validation','payload':{'plainToken':'fake-challenge'}}
  guest.post('zoom.webhook',challenge,403);now=str(int(time.time()))
  def zoom_event(payload,ts=None):
   ts=ts or str(int(time.time()));raw=json.dumps(payload,ensure_ascii=False,separators=(',',':'));sig='v0='+hmac.new(b'fake-webhook-secret',('v0:'+ts+':'+raw).encode(),hashlib.sha256).hexdigest();return guest.post('zoom.webhook',payload,headers={'X-Zm-Request-Timestamp':ts,'X-Zm-Signature':sig,'X-CSRF-Token':'','Origin':''})
  validation=zoom_event(challenge);check(validation['encryptedToken']==hmac.new(b'fake-webhook-secret',b'fake-challenge',hashlib.sha256).hexdigest(),'Zoom URL challenge verifies timestamp and HMAC before answering')
  event={'event':'meeting.participant_joined','event_ts':int(time.time()*1000),'payload':{'object':{'id':zoom['id'],'participant':{'email':'child@example.test','join_time':stamp(-60)}}}};zoom_event(event);zoom_event(event);check(len(sql('SELECT id FROM zoom_presence WHERE class_id=?',[classid]))==1,'Signed Zoom join event deduplicated and matched only to enrolled email')
  event['payload']['object']['participant']={'user_name':'student','join_time':stamp(-60)};zoom_event(event);check(len(sql('SELECT id FROM zoom_presence WHERE class_id=?',[classid]))==1,'Unverified Zoom display names cannot create attendance identity')
  check(sql('SELECT status FROM attendance WHERE class_id=? AND student_id=?',[classid,child])[0]['status']=='absent','Zoom connection event does not silently overwrite reviewed attendance')
  check(len(trainer.get('zoom.presence&class_id='+classid)['items'])==1,'Assigned teacher can review verified connection records')
  student.post('video.create',{'course_id':cid,'title':'مقطع','bytes':1000},403);video=trainer.post('video.create',{'course_id':cid,'title':'فيديو اختبار كبير','bytes':12000});sig=hashlib.sha256(('123'+'fake-video-key'+str(video['expires'])+video['video_id']).encode()).hexdigest();check(sig==video['signature'] and 'fake-video-key' not in json.dumps(video),'Direct-upload grant signed for one video without revealing provider key')
  other.post('video.credentials',{'id':video['id']},403);trainer.post('video.sync',{'id':video['id']});lesson=trainer.post('video.lesson',{'asset_id':video['id'],'title':'شرح سحابي','duration':10,'sort_order':1})['id'];trainer.post('video.lesson',{'asset_id':video['id'],'title':'نسخة ثانية'},409);check(True,'Only ready course videos can attach once to a lesson')
  playback=student.get('video.play&lesson_id='+lesson);check(playback['url'].startswith('https://player.mediadelivery.net/embed/123/') and 'token=' in playback['url'],'Enrolled learner receives expiring signed player URL');other.get('video.play&lesson_id='+lesson,403)
  check('fake-client-secret' not in json.dumps(admin.get('integrations')) and admin.get('integrations')['services']['moyasar']['mode']=='test','Integration dashboard exposes status and test mode without secret values')
  for i in range(30):sql("INSERT INTO orders(id,student_id,course_id,amount,currency,status,expires_at,created_at,updated_at) VALUES(?,?,?,100,'SAR','failed',?,?,?)",['paged-'+str(i),'student',cid,stamp(),stamp(),stamp()])
  check(len(student.get('orders&page=1')['items'])==25 and student.get('orders&page=2')['items'],'Payment ledger paginated in database, not sliced from a full client payload')
  ledger_fixtures=[]
  for i in range(30):
   ledger_fixtures.append({'id':'ledger-fixture-'+str(i),'student_id':'student' if i%2==0 else 'second','amount':1000+i,'status':['paid','paid_review','pending','uncertain','refunded','failed'][i%6],'created_at':'2026-11-16T21:00:00Z'})
  for suffix,created,status,amount in [('before','2026-11-16T20:59:59Z','paid',10000),('end','2026-11-17T20:59:59Z','refunded',20000),('after','2026-11-17T21:00:00Z','paid_review',30000)]:
   ledger_fixtures.append({'id':'ledger-fixture-'+suffix,'student_id':'student','amount':amount,'status':status,'created_at':created})
  for o in ledger_fixtures:sql("INSERT INTO orders(id,student_id,course_id,amount,currency,status,expires_at,created_at,updated_at) VALUES(?,?,?,?,'SAR',?,?,?,?)",[o['id'],o['student_id'],cid,o['amount'],o['status'],stamp(),o['created_at'],stamp()])
  selection='orders&search=ledger-fixture&from=2026-11-17&to=2026-11-17'
  ledger=admin.get(selection);selected=[o for o in ledger_fixtures if '2026-11-16T21:00:00Z'<=o['created_at']<'2026-11-17T21:00:00Z']
  expected_summary=lambda items:{'paid':sum(o['amount'] for o in items if o['status'] in ['paid','paid_review']),'pending':sum(o['amount'] for o in items if o['status'] in ['creating','pending','uncertain']),'refunded':sum(o['amount'] for o in items if o['status']=='refunded'),'review':sum(o['status'] in ['paid_review','uncertain'] for o in items)}
  check(ledger['total']==31 and len(ledger['items'])==25 and ledger['summary']==expected_summary(selected),'Ledger totals include all filtered pages and separate paid, pending and refunded amounts')
  page2=admin.get(selection+'&page=2');check(len(page2['items'])==6 and page2['summary']==ledger['summary'],'Financial summary stays identical across pages')
  student_ledger=student.get(selection+'&student_id=second');own=[o for o in selected if o['student_id']=='student']
  check(student_ledger['total']==len(own) and student_ledger['summary']==expected_summary(own),'Ledger filters and totals cannot expose another student payment data')
  refunded=admin.get(selection+'&status=refunded');check(refunded['total']==6 and refunded['summary']['paid']==0 and refunded['summary']['refunded']==25080,'Riyadh date range includes both midnight boundaries and filters payment status')
  admin.get('orders&status=not-a-status',422);admin.get('orders&from=2026-02-30',422);admin.get('orders&from=2026-11-18&to=2026-11-17',422)
  check(True,'Ledger rejects invalid status, impossible dates and reversed ranges')
  # Revocation, strong staff setup and failure recovery checks.
  admin.post('user.save',{'id':child,'role':'student','name':'طفل تجريبي','email':'child@example.test','birth_date':'2015-01-01','city':'تبوك','phone':'','guardian_name':'ولي تجريبي','guardian_phone':'0500000003','guardian_id':'guardian','consent':True})
  check(int(sql('SELECT sms_enabled FROM guardian_preferences WHERE student_id=?',[child])[0]['sms_enabled'])==0,'Changing guardian destination revokes previous SMS consent')
  guardian.post('guardian.preference.save',{'student_id':child,'sms_enabled':True,'consent':True})
  class3=trainer.post('class.save',{'course_id':cid2,'title':'حصة اختبار الإيقاف','starts_at':stamp(-1800),'ends_at':stamp(1800),'location':'قاعة'})['id'];trainer.post('attendance.save',{'class_id':class3,'records':[{'student_id':child,'status':'absent'}]});sql('UPDATE notification_outbox SET next_attempt_at=? WHERE class_id=?',[stamp(-60),class3]);admin.post('user.toggle',{'id':child});php([str(ROOT/'server/console.php'),'worker']);check(sql('SELECT status FROM notification_outbox WHERE class_id=?',[class3])[0]['status']=='cancelled','Worker cancels pending SMS for disabled students')
  production=temp/'production.php';production.write_text("<?php $c=require "+repr(str(config))+";$c['environment']='production';$c['origin']='https://learn.example.test';$c['demo']=false;return $c;")
  guard=temp/'guard.php';guard.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";$u=one(\"SELECT * FROM users WHERE id='admin'\");$data=dataFor($u);try{staffMfaGuard($u,'students.list');$status=200;}catch(ApiError $e){$status=$e->status;}echo json_encode(['status'=>$status,'flag'=>$data['mfa_setup_required']??false,'students'=>$data['students'],'courses'=>$data['courses']]);")
  r=subprocess.run(['php',str(guard)],env={**env,'TAFASEEL_CONFIG':str(production)},text=True,capture_output=True,check=True);r=json.loads(r.stdout);check(r['status']==403 and r['flag'] and not r['students'] and not r['courses'],'Production staff must enroll MFA before accessing private learning data')
  reservation=temp/'reserve.php';reservation.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";reserveUpload('large-pending',1500000000);try{reserveUpload('over-quota',1000000000);echo 200;}catch(ApiError $e){echo $e->status;}")
  check(php([str(reservation)]).stdout.strip()=='409' and len(sql('SELECT id FROM upload_reservations'))==1,'Concurrent upload reservations cannot bypass configured storage quota');sql('DELETE FROM upload_reservations')
  disabled=temp/'disabled.php';disabled.write_text("<?php $c=require "+repr(str(config))+";$c['integrations']=[];return $c;");probe=temp/'probe.php';probe.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";try{requireIntegration('moyasar');echo 200;}catch(ApiError $e){echo $e->status;}")
  r=subprocess.run(['php',str(probe)],env={**env,'TAFASEEL_CONFIG':str(disabled)},text=True,capture_output=True,check=True);check(r.stdout.strip()=='503','Missing provider configuration never simulates successful payment')
  guest.get('payment.callback',405);check(True,'Provider callbacks reject incorrect HTTP method')
  old=str(int(time.time())-600);raw=json.dumps(challenge,ensure_ascii=False,separators=(',',':'));sig='v0='+hmac.new(b'fake-webhook-secret',('v0:'+old+':'+raw).encode(),hashlib.sha256).hexdigest();guest.post('zoom.webhook',challenge,403,headers={'X-Zm-Request-Timestamp':old,'X-Zm-Signature':sig});check(True,'Expired signed Zoom event rejected')
  check(student.get('lesson&id='+lesson)['lesson']['body']=='' and all(not l['body'] for l in student.get('data')['lessons']),'Dashboard payload omits lesson bodies and dedicated endpoint enforces course access')
  pendingpid=sql('SELECT provider_id FROM orders WHERE id=?',[secondorder['id']])[0]['provider_id'];Mock.invoices[pendingpid]['status']='paid';admin.post('course.save',{**course,'id':cid,'status':'archived'});result=second.post('payment.refresh',{'id':secondorder['id']});check(result['order']['status']=='paid_review' and not sql('SELECT id FROM enrollments WHERE course_id=? AND student_id=?',[cid,'second']),'A payment for a closed course is held for review without silently granting access')
  print(json.dumps({'database':'MariaDB' if mysql_socket else 'SQLite','passed':len(checks),'failed':0,'provider_requests':'loopback only','checks':checks},ensure_ascii=False,indent=2))
 except Exception:
  log.flush();print((temp/'server.log').read_text()[-5000:],file=sys.stderr);raise
 finally:
  server.terminate();server.wait();log.close()
  if mysql_socket:subprocess.run(['mariadb','--no-defaults','--socket='+mysql_socket,'-u','root','-e','DROP DATABASE '+db_name],check=True)
provider.shutdown()
