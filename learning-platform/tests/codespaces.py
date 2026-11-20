"""Isolated real-backend trial lifecycle tests; never uses GitHub credentials or real provider accounts."""
from pathlib import Path
import tempfile,shutil,subprocess,os,json,socket,time,urllib.request,urllib.error,http.cookiejar,sqlite3,hashlib
ROOT=Path(__file__).resolve().parents[1];checks=[]
def check(v,label):
 assert v,label
 checks.append(label)
class LoopbackCookiePolicy(http.cookiejar.DefaultCookiePolicy):
 # Model the HTTPS forwarding edge in this loopback-only HTTP test transport.
 def return_ok_secure(self,cookie,request):
  return request.host.startswith('127.0.0.1:') or super().return_ok_secure(cookie,request)
with tempfile.TemporaryDirectory(prefix='tafaseel-codespaces-') as folder:
 root=Path(folder)
 shutil.copytree(ROOT/'server',root/'server',ignore=shutil.ignore_patterns('config.php'))
 (root/'dist/assets').mkdir(parents=True);(root/'public/api').mkdir(parents=True)
 shutil.copy2(ROOT/'public/api/index.php',root/'public/api/index.php')
 (root/'dist/index.html').write_text('<html><h1>Trial fixture</h1></html>')
 (root/'dist/.htaccess').write_text('PRIVATE FIXTURE')
 (root/'dist/assets/sample.js').write_text('console.log("safe fixture")')
 env={**os.environ,'CODESPACES':'true','CODESPACE_NAME':'tafaseel-isolated-test','GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN':'app.github.dev'}
 env.pop('TAFASEEL_CONFIG',None);env.pop('TAFASEEL_TRIAL_LOCAL_ORIGIN',None)
 init=lambda: subprocess.run(['php','server/codespaces-init.php','init'],cwd=root,env=env,capture_output=True,text=True,check=True)
 first=json.loads(init().stdout);private=root/'.local/github-trial';config=private/'config.php';accounts=private/'accounts.json';db=sqlite3.connect(private/'learning.sqlite')
 check(first['created'] and first['demo_login'] is False,'Trial creates real server database without demo login')
 check(first['origin']=='https://tafaseel-isolated-test-8080.app.github.dev','Codespaces origin derives from validated forwarding hostname')
 check(db.execute('SELECT COUNT(*) FROM users').fetchone()[0]>4,'All four roles and usable fictional training records initialized')
 credentials=json.loads(accounts.read_text());passwords=[v['password'] for v in credentials.values()]
 check(len(set(passwords))==len(passwords) and all(len(p)>=32 for p in passwords),'Accounts receive unique random passwords stored privately')
 check(oct(config.stat().st_mode&0o777)=='0o600' and oct(accounts.stat().st_mode&0o777)=='0o600','Configuration and credentials restricted to workspace owner')
 check(not (root/'server/config.php').exists() and not (root/'.local/accounts.json').exists(),'Trial initialization does not overwrite ordinary local config or credentials')
 key_hash=hashlib.sha256(config.read_bytes()).hexdigest();account_hash=hashlib.sha256(accounts.read_bytes()).hexdigest();db.execute("UPDATE courses SET title='محفوظ بعد إعادة التشغيل' WHERE id=(SELECT id FROM courses LIMIT 1)");db.commit()
 second=json.loads(init().stdout)
 check(not second['created'] and db.execute("SELECT COUNT(*) FROM courses WHERE title='محفوظ بعد إعادة التشغيل'").fetchone()[0]==1,'Restart preserves edited courses and does not reseed')
 check(hashlib.sha256(config.read_bytes()).hexdigest()==key_hash and hashlib.sha256(accounts.read_bytes()).hexdigest()==account_hash,'Restart preserves encryption key and account credentials')
 check(not any(p for p in passwords if p in first.__str__()),'Initialization output does not leak passwords')
 bad={**env,'GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN':'attacker.example'}
 check(subprocess.run(['php','server/codespaces-init.php','init'],cwd=root,env=bad,capture_output=True).returncode!=0,'Untrusted forwarding domain rejected')
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 origin=first['origin'];base=f'http://127.0.0.1:{port}'
 jar=http.cookiejar.CookieJar(policy=LoopbackCookiePolicy());client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));csrf=''
 def call(path,body=None,expected=200):
  global csrf
  req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers={'Origin':origin,'Content-Type':'application/json','X-CSRF-Token':csrf})
  try:
   with client.open(req) as r:status=r.status;raw=r.read();headers=r.headers
  except urllib.error.HTTPError as e:status=e.code;raw=e.read();headers=e.headers
  assert status==expected,(path,status,raw[:180])
  try:r=json.loads(raw)
  except ValueError:r={'raw':raw.decode()}
  if 'csrf' in r:csrf=r['csrf']
  return r,headers
 server_env={**env,'TAFASEEL_CONFIG':str(config)};log=open(private/'test-web.log','w');server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t','dist','server/codespaces-router.php'],cwd=root,env=server_env,stdout=log,stderr=log)
 try:
  for i in range(50):
   try:health,_=call('/api/index.php?action=health');break
   except Exception:time.sleep(.1)
  check(health['ok'],'Private trial router reaches actual PHP API')
  session,headers=call('/api/index.php?action=session');check(session['demo'] is False and session['user'] is None,'Public session exposes no demo entry or logged-in role')
  check(any(c.name.startswith('__Host-') and c.secure and c.get_nonstandard_attr('SameSite')=='Strict' for c in jar),'Forwarded HTTPS session retains secure host-bound cookies')
  call('/api/index.php?action=demo',{'role':'admin'},404);check(True,'Role-switch bypass unavailable in temporary GitHub backend')
  for path in ['/.htaccess','/.local/github-trial/config.php','/server/config.php','/vendor/autoload.php','/assets/../.local/accounts.json','/missing.js']:call(path,expected=404)
  check(True,'Trial router blocks private files, dotfiles, traversal and missing assets')
  r,h=call('/students');check('Trial fixture' in r['raw'] and "script-src 'self'" in h.get('Content-Security-Policy',''),'Application routes serve production SPA with CSP')
  email=next(k for k,v in credentials.items() if v['role']=='student');pw=credentials[email]['password']
  login,_=call('/api/index.php?action=login',{'email':email,'password':pw});check(login['user']['role']=='student','Trial student authenticates using actual password verification')
  data,_=call('/api/index.php?action=data');check(data['courses'] and data['demo'] is False,'Learner receives real scoped courses from server database')
  lid=next(l['id'] for l in data['lessons'] if not any(p['lesson_id']==l['id'] for p in data['progress']));call('/api/index.php?action=progress',{'lesson_id':lid});check(db.execute('SELECT COUNT(*) FROM progress WHERE lesson_id=? AND student_id=?',(lid,login['user']['id'])).fetchone()[0]==1,'Trial lesson completion persists in server database')
  call('/api/index.php?action=logout',{})
  admin=next(k for k,v in credentials.items() if v['role']=='admin');call('/api/index.php?action=login',{'email':admin,'password':credentials[admin]['password']});d,_=call('/api/index.php?action=data');call('/api/index.php?action=users.list',expected=403)
  check(d['mfa_setup_required'] and not d['courses'],'Production MFA remains enforced for trial staff')
 finally:server.terminate();server.wait(timeout=5);log.close();db.close()
print(json.dumps({'passed':len(checks),'failed':0,'checks':checks},ensure_ascii=False,indent=2))
