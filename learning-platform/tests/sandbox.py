"""Local-only, disposable PHP/PDO system test environment."""
import os, pathlib, tempfile, subprocess, socket, time, json, urllib.request, urllib.error, http.cookiejar, signal

ROOT = pathlib.Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:3117'

class Client:
    def __init__(self, base):
        self.base=base; self.csrf=''; self.jar=http.cookiejar.CookieJar()
        self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar)); self.get('session')
    def call(self, action, body=None, expected=200, headers=None):
        data=None if body is None else json.dumps(body,ensure_ascii=False).encode()
        h={'Origin':ORIGIN,'Content-Type':'application/json','X-CSRF-Token':self.csrf}; h.update(headers or {})
        req=urllib.request.Request(self.base+'/api/index.php?action='+action,data=data,headers=h)
        start=time.perf_counter()
        try:
            with self.http.open(req,timeout=90) as response: status=response.status; raw=response.read(); response_headers=response.headers
        except urllib.error.HTTPError as response: status=response.code; raw=response.read(); response_headers=response.headers
        elapsed=(time.perf_counter()-start)*1000
        assert status==expected,(action,status,raw[:350])
        result=json.loads(raw)
        if 'csrf' in result: self.csrf=result['csrf']
        return result, {'milliseconds':round(elapsed,2),'bytes':len(raw),'status':status,'headers':dict(response_headers)}
    def get(self, action, expected=200): return self.call(action,expected=expected)[0]
    def post(self, action, body, expected=200, headers=None): return self.call(action,body,expected,headers)[0]
    def upload(self, payload, filename, mime, course, expected=200):
        boundary='tafaseel'+str(time.time_ns())
        raw=b''.join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k,v in {'purpose':'resource','course_id':course}.items())
        raw+=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+payload+f'\r\n--{boundary}--\r\n'.encode()
        req=urllib.request.Request(self.base+'/api/index.php?action=file.upload',data=raw,headers={'Origin':ORIGIN,'X-CSRF-Token':self.csrf,'Content-Type':'multipart/form-data; boundary='+boundary})
        try:
            with self.http.open(req,timeout=60) as response: status=response.status; raw=response.read()
        except urllib.error.HTTPError as response: status=response.code; raw=response.read()
        assert status==expected,(status,raw[:350]); return json.loads(raw)

class Sandbox:
    def __init__(self, smtp_port=None):
        self.smtp_port=smtp_port
    def __enter__(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='tafaseel-simulation-'); self.folder=pathlib.Path(self.tmp.name)
        self.mysql=os.environ.get('TAFASEEL_TEST_MYSQL_SOCKET'); self.name='tafaseel_sim_'+os.urandom(5).hex()
        if self.mysql: self.mysql_command('CREATE DATABASE '+self.name+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        dsn=f'mysql:unix_socket={self.mysql};dbname={self.name};charset=utf8mb4' if self.mysql else 'sqlite:'+str(self.folder/'database.sqlite')
        self.config=self.folder/'config.php'
        self.config.write_text("<?php return ['environment'=>'local','demo'=>false,'testing'=>true,'simulation'=>true,'enforce_staff_mfa'=>false,'staff_mfa_enabled'=>false,'origin'=>'"+ORIGIN+"','dsn'=>'"+dsn+"','db_user'=>'root','db_password'=>'','key'=>'"+os.urandom(32).hex()+"','storage'=>'"+str(self.folder/'storage')+"'];")
        if self.smtp_port is not None:
            assert 0<int(self.smtp_port)<65536
            self.config.write_text(self.config.read_text().replace("'storage'=>", "'test_smtp_port'=>"+str(int(self.smtp_port))+",'storage'=>"))
        self.config.chmod(0o600); self.password='Simulation-'+os.urandom(16).hex()+'!'
        self.env={**os.environ,'TAFASEEL_CONFIG':str(self.config),'TAFASEEL_SIM_PASSWORD':self.password}
        self.php([str(ROOT/'server/console.php'),'migrate'])
        self.query=self.folder/'query.php'; self.query.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";$d=json_decode(stream_get_contents(STDIN),true);$s=db()->prepare($d['sql']);$s->execute($d['args']??[]);echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));")
        with socket.socket() as sock: sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        self.base=f'http://127.0.0.1:{port}'; self.log=open(self.folder/'server.log','w')
        self.server=subprocess.Popen(['php','-d','memory_limit=256M','-S',f'127.0.0.1:{port}','-t',str(ROOT/'dist'),str(ROOT/'server/preview-router.php')],env={**self.env,'PHP_CLI_SERVER_WORKERS':'8'},stdout=self.log,stderr=self.log,start_new_session=True)
        for _ in range(100):
            try: Client(self.base); break
            except Exception: time.sleep(.1)
        return self
    def php(self, args, **kwargs):
        result=subprocess.run(['php',*args],env=self.env,text=True,capture_output=True,**kwargs)
        if result.returncode: raise RuntimeError(result.stderr or result.stdout)
        return result
    def mysql_command(self, sql):
        subprocess.run(['mariadb','--no-defaults','--socket='+self.mysql,'-u','root','-e',sql],check=True,capture_output=True)
    def sql(self, sql, args=None): return json.loads(self.php([str(self.query)],input=json.dumps({'sql':sql,'args':args or []})).stdout)
    def login(self, id):
        client=Client(self.base); client.post('login',{'email':id+'@example.test','password':self.password}); return client
    def __exit__(self, kind, value, trace):
        if kind:
            self.log.flush(); print((self.folder/'server.log').read_text()[-2500:])
        os.killpg(self.server.pid,signal.SIGTERM)
        try: self.server.wait(timeout=5)
        except subprocess.TimeoutExpired: os.killpg(self.server.pid,signal.SIGKILL); self.server.wait()
        self.log.close()
        if self.mysql: self.mysql_command('DROP DATABASE '+self.name)
        self.tmp.cleanup()
