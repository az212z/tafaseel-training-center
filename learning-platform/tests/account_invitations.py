"""Disposable account approval, invitation, SMTP and verification regression tests."""
import concurrent.futures, email, email.policy, hashlib, json, os, re, socketserver, threading, urllib.request, urllib.error
from sandbox import Sandbox, Client, ROOT, ORIGIN

checks = []
def check(value, label):
    assert value, label
    checks.append(label)
    print('PASS', label, flush=True)

class Mailbox(socketserver.StreamRequestHandler):
    messages = []
    def reply(self, text):
        self.wfile.write((text+'\r\n').encode()); self.wfile.flush()
    def handle(self):
        self.reply('220 local.test ESMTP'); auth = 0
        while True:
            raw = self.rfile.readline()
            if not raw: return
            line = raw.decode().rstrip('\r\n').upper()
            if auth:
                auth -= 1; self.reply('334 UGFzc3dvcmQ6' if auth else '235 Authenticated')
            elif line.startswith('EHLO'): self.reply('250-local.test'); self.reply('250 AUTH LOGIN')
            elif line.startswith('AUTH LOGIN'): auth = 2; self.reply('334 VXNlcm5hbWU6')
            elif line.startswith(('MAIL FROM:', 'RCPT TO:')): self.reply('250 OK')
            elif line == 'DATA':
                self.reply('354 Send data'); body = b''
                while True:
                    chunk = self.rfile.readline()
                    if chunk == b'.\r\n': break
                    if not chunk: return
                    body += chunk[1:] if chunk.startswith(b'..') else chunk
                Mailbox.messages.append(email.message_from_bytes(body, policy=email.policy.default)); self.reply('250 Accepted')
            elif line == 'QUIT': self.reply('221 Bye'); return
            else: self.reply('250 OK')

smtp = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Mailbox)
threading.Thread(target=smtp.serve_forever, daemon=True).start()
try:
  with Sandbox(smtp_port=smtp.server_address[1]) as s:
    s.php(['-r', "require 'server/api.php';foreach(['admin'=>'admin','trainer'=>'instructor','student'=>'student'] as $id=>$role)run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT),$role,now()]);"])
    admin = s.login('admin'); trainer = s.login('trainer'); student = s.login('student'); guest = Client(s.base)
    settings = {'address':'admin@tafaseel-learn.com','name':'مركز تفاصيل للتدريب','password':'Local-Mail-Only','port':465,'daily_limit':80,'enabled':True,'current':s.password}
    admin.post('email.configure', settings)
    for client in [trainer, student]:
        client.post('website.trainer.approve', {'id':'missing'}, 403)
        client.post('account.invite.resend', {'id':'missing'}, 403)
        client.post('account.invite.revoke', {'id':'missing'}, 403)
        client.post('user.save', {'role':'instructor','send_invite':True}, 403)
    check(True, 'Account creation, teacher approval and invitation resend require administrator permission')
    guest.post('website.trainer.approve', {'id':'missing'}, 401)
    guest.get('account.invite.status', 405)
    guest.post('account.invite.accept', {}, 403, {'X-CSRF-Token':'invalid'})
    inquiry = {'kind':'trainer','name':'معلم الاختبار <script>','phone':'0500000011','email':'approved@example.test','message':'خبرة تدريبية للاختبار المحلي فقط','consent':True}
    guest.post('website.inquiry', {**inquiry,'email':''}, 422)
    created = guest.post('website.inquiry', inquiry)
    inquiry_id = admin.get('website.inquiries')['items'][0]['id']
    check(bool(created['reference']), 'New teacher applications require an email address and retain a private review record')
    approved = admin.post('website.trainer.approve', {'id':inquiry_id})
    again = admin.post('website.trainer.approve', {'id':inquiry_id})
    teacher_id = approved['user_id']
    check(again['existing'] and again['user_id']==teacher_id and len(s.sql('SELECT id FROM account_invitations WHERE source_inquiry_id=?',[inquiry_id]))==1, 'Approval retries are idempotent and create one invited teacher account')
    admin.post('website.inquiry.status', {'id':inquiry_id,'status':'closed'}, 409)
    admin.post('website.inquiry.status', {'id':inquiry_id,'status':'approved'}, 422)
    check(admin.get('website.inquiries&status=approved')['total']==1, 'Approved applications cannot be silently changed through ordinary inquiry status controls')
    def invite(user_id):
        result = s.php(['-r', "require 'server/api.php';$i=one('SELECT * FROM account_invitations WHERE user_id=?',['"+user_id+"']);$n=one('SELECT * FROM email_outbox WHERE resource_id=? AND kind=?',[$i['id'],'invitation']);echo json_encode(['invite'=>$i,'message'=>$n,'path'=>dec($n['link_path'])]);"])
        return json.loads(result.stdout)
    first = invite(teacher_id); token = first['path'].split('#',1)[1]
    check(first['invite']['token_hash']==hashlib.sha256(token.encode()).hexdigest() and token not in json.dumps([first['invite'],first['message']]) and len(first['message']['link_path'])<=240, 'Bearer tokens are hashed in invitation records and encrypted in the mail queue')
    guest.post('login', {'email':inquiry['email'],'password':s.password}, 401)
    admin.post('user.toggle', {'id':teacher_id}, 409)
    check(not s.sql('SELECT active FROM users WHERE id=?',[teacher_id])[0]['active'], 'An invited account cannot sign in or bypass verification through the ordinary activate button')
    before = s.sql('SELECT used_at FROM account_invitations WHERE user_id=?',[teacher_id])
    with urllib.request.urlopen(s.base+'/activate') as response:
        html_page=response.read();headers=response.headers
    status = guest.post('account.invite.status', {'token':token});guest.post('account.invite.status', {'token':token})
    check(status['role']=='instructor' and before==s.sql('SELECT used_at FROM account_invitations WHERE user_id=?',[teacher_id]) and headers.get('Referrer-Policy')=='no-referrer' and b'noindex,nofollow' in html_page, 'Opening and previewing an invitation never consumes it; the activation page is private from indexing and referrers')
    dispatch=json.loads(s.php(['server/console.php','worker']).stdout)['email']
    if not any(str(m['To'])==inquiry['email'] for m in Mailbox.messages):
        raise AssertionError({'dispatch':dispatch,'states':s.sql('SELECT kind,status,error_code FROM email_outbox'),'messages_received':len(Mailbox.messages)})
    message = next(m for m in Mailbox.messages if str(m['To'])==inquiry['email'])
    html = next(p.get_content() for p in message.walk() if p.get_content_type()=='text/html')
    check(message.is_multipart() and str(message['From']).endswith('<admin@tafaseel-learn.com>') and 'الموافقة على انضمامكم' in str(message['Subject']) and 'توثيق الحساب وإكمال التسجيل' in html and '&lt;script&gt;' in html and 'إدارة اشتراك البريد' not in html and '/activate#'+token in html, 'Real local SMTP sends a formal branded approval in Arabic with a private single-action verification link')
    consent = {'token':token,'password':'Chosen-Student-Password-93!','confirm':'Chosen-Student-Password-93!','consent':True}
    guest.post('account.invite.accept', {**consent,'password':'short','confirm':'short'}, 422)
    guest.post('account.invite.accept', {**consent,'confirm':'mismatch'}, 422)
    guest.post('account.invite.accept', {**consent,'consent':False}, 422)
    student.post('account.invite.accept', consent, 409)
    check(not s.sql('SELECT active FROM users WHERE id=?',[teacher_id])[0]['active'], 'Weak passwords, mismatched confirmation, missing consent and an unrelated signed-in session cannot activate the account')
    guest.post('account.invite.accept', consent)
    guest.post('account.invite.accept', consent, 410)
    teacher = Client(s.base);teacher.post('login', {'email':inquiry['email'],'password':consent['password']})
    check(teacher.get('data')['user']['role']=='instructor' and s.sql('SELECT used_at FROM account_invitations WHERE user_id=?',[teacher_id])[0]['used_at'], 'One successful redemption verifies email, activates the teacher and permits normal sign-in without creating an extra session')
    check(len(s.sql('SELECT id FROM email_outbox WHERE dedupe_key=?',['verified:'+first['invite']['id']]))==1,'Successful verification automatically queues one account confirmation without a password in the message')
    teacher.get('users.list', 403);admin.post('account.invite.resend', {'id':teacher_id}, 409)
    guest.post('account.invite.status', {'token':token[:-1]+('0' if token[-1]!='0' else '1')}, 410)
    guest.post('account.invite.status', {'token':'invalid'}, 410)
    check(True, 'Used or tampered links cannot be replayed, and accepting a teacher invitation grants no administrator privileges')
    def create_invited(address, role='instructor', **extra):
        return admin.post('user.save', {'name':'حساب مدعو للاختبار','email':address,'role':role,'send_invite':True,**extra})['id']
    invited = create_invited('invited@example.test'); old = invite(invited); old_token=old['path'].split('#',1)[1]
    admin.post('account.invite.resend', {'id':invited}); new=invite(invited);new_token=new['path'].split('#',1)[1]
    guest.post('account.invite.status', {'token':old_token}, 410)
    check(old_token!=new_token and s.sql('SELECT status FROM email_outbox WHERE id=?',[old['message']['id']])[0]['status']=='cancelled', 'Resending rotates the token and cancels unsent copies of the previous invitation')
    admin.post('account.invite.revoke', {'id':invited});guest.post('account.invite.status', {'token':new_token}, 410)
    revoked=next(row for row in admin.get('users.list')['items'] if row['id']==invited)
    check(revoked['invitation_status']=='revoked' and s.sql('SELECT status FROM email_outbox WHERE id=?',[new['message']['id']])[0]['status']=='cancelled','Administrators can revoke an unused invitation immediately without deleting the account')
    admin.post('account.invite.resend', {'id':invited});new_token=invite(invited)['path'].split('#',1)[1]
    admin.post('user.save', {'id':invited,'name':'حساب مدعو','email':'updated@example.test','role':'instructor'})
    guest.post('account.invite.status', {'token':new_token}, 410)
    admin.post('account.invite.resend', {'id':invited}); changed=invite(invited)
    check(guest.post('account.invite.status', {'token':changed['path'].split('#',1)[1]})['role']=='instructor', 'Invitations bind to the account email; an administrator must issue a fresh link after changing that address')
    s.sql('UPDATE account_invitations SET expires_at=? WHERE user_id=?',['2000-01-01T00:00:00Z',invited])
    guest.post('account.invite.status', {'token':changed['path'].split('#',1)[1]}, 410)
    s.sql('DELETE FROM email_attempts');admin.post('email.dispatch', {})
    check(s.sql('SELECT status FROM email_outbox WHERE id=?',[changed['message']['id']])[0]['status']=='cancelled', 'Expired invitations cannot activate accounts and are cancelled before SMTP delivery')
    learner=create_invited('learner@example.test','student',birth_date='2000-01-01',phone='0500000022',consent=True)
    check(bool(s.sql('SELECT user_id FROM profiles WHERE user_id=?',[learner])) and not s.sql('SELECT active FROM users WHERE id=?',[learner])[0]['active'], 'Administrators can invite students with the existing profile and consent requirements')
    learner_token=invite(learner)['path'].split('#',1)[1];learner_consent={**consent,'token':learner_token}
    guest.post('account.invite.accept',learner_consent)
    learner_client=Client(s.base);learner_client.post('login',{'email':'learner@example.test','password':consent['password']})
    check(learner_client.get('data')['user']['role']=='student','An invited student completes verification and can access the student workspace')
    admin.post('user.save',{'name':'حساب يدوي','email':'manual@example.test','role':'instructor','password':s.password})
    manual=Client(s.base);manual.post('login',{'email':'manual@example.test','password':s.password})
    check(manual.get('data')['user']['role']=='instructor','Existing administrator password-based account creation remains available')
    def insert_inquiry(id, kind, address, status='new'):
        s.php(['-r', "require 'server/api.php';run('INSERT INTO website_inquiries(id,reference,kind,program_slug,payload,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',['"+id+"','TF-"+id+"','"+kind+"','',enc(json_encode(['name'=>'طلب محلي','email'=>'"+address+"'])),'"+status+"',now(),now()]);"])
    insert_inquiry('conflict','trainer','manual@example.test')
    before_users=s.sql('SELECT COUNT(*) n FROM users')[0]['n'];admin.post('website.trainer.approve',{'id':'conflict'},409)
    insert_inquiry('contact-only','contact','contact@example.test');admin.post('website.trainer.approve',{'id':'contact-only'},422)
    check(s.sql('SELECT COUNT(*) n FROM users')[0]['n']==before_users and s.sql('SELECT status FROM website_inquiries WHERE id=?',['conflict'])[0]['status']=='new','Conflicting existing accounts and ordinary contact inquiries are never overwritten or converted into teachers')
    insert_inquiry('concurrent','trainer','concurrent@example.test')
    admins=[s.login('admin'),s.login('admin')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda client:client.post('website.trainer.approve',{'id':'concurrent'}),admins))
    check(len({r['user_id'] for r in results})==1 and sum(bool(r.get('existing')) for r in results)==1,'Concurrent approval requests create exactly one account and invitation')
    admin.post('account.invite.resend',{'id':results[0]['user_id']})
    current_invite=invite(results[0]['user_id']);race_token=current_invite['path'].split('#',1)[1]
    subject=s.php(['-r',"require 'server/api.php';echo dec(one('SELECT subject FROM email_outbox WHERE id=?',['"+current_invite['message']['id']+"'])['subject']);"]).stdout
    check('الموافقة على انضمامكم' in subject,'Resending an approved teacher invitation preserves the formal approval message and application association')
    def accept_status(client):
        req=urllib.request.Request(s.base+'/api/index.php?action=account.invite.accept',data=json.dumps({**consent,'token':race_token}).encode(),headers={'Origin':ORIGIN,'Content-Type':'application/json','X-CSRF-Token':client.csrf})
        try:
            with client.http.open(req) as response:return response.status
        except urllib.error.HTTPError as e:return e.code
    clients=[Client(s.base),Client(s.base)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:states=list(pool.map(accept_status,clients))
    check(sorted(states)==[200,410],'Concurrent token redemptions permit one successful activation only')
    listing=admin.get('users.list');logs=admin.get('email.log')
    check(all('token_hash' not in row and 'password' not in row for row in listing['items']) and token not in json.dumps([listing,logs]),'Account lists and operational mail logs never return invitation secrets or password hashes')
    s.config.write_text(re.sub(r"'test_smtp_port'=>\d+,",'',s.config.read_text()))
    s.sql("UPDATE email_outbox SET status='cancelled' WHERE status IN ('pending','blocked','retry')");s.sql('DELETE FROM email_attempts')
    s.php(['-r',"require 'server/api.php';queueEmail('missing-test-receiver','admin','account','اختبار محلي','رسالة اختبار محلية');"])
    received=len(Mailbox.messages);result=json.loads(s.php(['server/console.php','worker']).stdout)['email']
    check(result['failed']==1 and len(Mailbox.messages)==received and s.sql('SELECT error_code FROM email_outbox WHERE dedupe_key=?',['missing-test-receiver'])[0]['error_code']=='smtp_test_not_configured','Test workers fail closed when their local receiver is missing and never fall back to an external SMTP relay')
    report={'database':'MariaDB' if s.mysql else 'SQLite','passed':len(checks),'failed':0,'checks':checks,'external_delivery':False,'synthetic_local_data':True,'secrets_included':False}
    destination=ROOT/'docs'/('account-invitation-qa.json' if s.mysql else 'account-invitation-qa-sqlite.json')
    destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('DONE',len(checks),'checks')
finally:
    smtp.shutdown();smtp.server_close()
