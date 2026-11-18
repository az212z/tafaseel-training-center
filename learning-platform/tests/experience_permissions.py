"""Isolated regressions for course signup, role scoping, PDF delivery and recoverable removal."""
from pathlib import Path
import datetime, hashlib, json, urllib.request, urllib.error, os, time
from sandbox import Sandbox, Client, ROOT

checks=[]
(ROOT/'output/experience-20261118').mkdir(parents=True,exist_ok=True)
def check(value, label):
    assert value,label
    checks.append(label)
    print('PASS '+label,flush=True)

with Sandbox() as s:
    s.php(['-r', """require 'server/api.php';
      $h=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);
      foreach(['admin'=>'admin','instructor'=>'instructor','other'=>'instructor','student'=>'student','second'=>'student'] as $id=>$role)
        run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$h,$role,'2026-01-01T00:00:00Z']);
      setSetting('admin_login',['user_id'=>'admin','username'=>'admin']);
      foreach(['own'=>'instructor','foreign'=>'other','free'=>'instructor','paid'=>'instructor'] as $cid=>$teacher) {
        run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,capacity,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[$cid,'دورة '.$cid,'درس تطبيقي','عام','/images/courses/foundation.webp','published',$teacher,20,'2026-01-01T00:00:00Z']);
        run('INSERT INTO course_commerce(course_id,price_minor,enrollment_open,updated_at) VALUES(?,?,1,?)',[$cid,$cid==='paid'?50000:0,now()]);
      }
      run('INSERT INTO enrollments(id,student_id,course_id,created_at) VALUES(?,?,?,?)',['enrollment','student','own','2026-01-01T00:00:00Z']);
    """])
    admin=s.login('admin');teacher=s.login('instructor');other=s.login('other')
    student=s.login('student');second=s.login('second');guest=Client(s.base)
    for role,client in [('student',student),('instructor',teacher)]:
        data=client.get('data')
        check(not data.get('instructors') and not data.get('users') and not data.get('audit') and not data.get('commerce'),
              role+' data omits management account lists, audit and commerce')
        ids={c['id'] for c in data['courses']}
        check(ids==({'own'} if role=='student' else {'own','free','paid'}),
              role+' sees only enrolled or assigned courses')
        client.get('users.list',403);client.get('integrations',403);client.get('trash.list',403)
    teacher.post('course.save',{'id':'own'},403)
    check(True,'Instructor cannot change center course publication or assignment')
    student.post('course.apply',{'course_id':'free'})
    check(student.post('course.apply',{'course_id':'free'})['enrolled'],'Free enrollment is immediate and safe to retry')
    paid=student.post('course.apply',{'course_id':'paid','amount':0,'status':'paid'})
    check(paid=={'enrolled':False,'requested':True} and not s.sql("SELECT id FROM enrollments WHERE course_id='paid'"),
          'Paid request is retained while an unconfigured gateway grants no enrollment')
    check(student.get('course.requests')['total']==2 and second.get('course.requests')['total']==0,
          'Course request history is limited to the account owner')
    teacher.get('course.requests',403)
    form={'name':'طالب تجريبي','email':'applicant@example.test','password':s.password,'birth_date':'2000-01-01','phone':'0500000010','consent':True,'course_id':'free'}
    guest.post('register',form)
    applicant=s.sql('SELECT id FROM users WHERE email=?',[form['email']])[0]['id']
    check(s.sql('SELECT course_id FROM course_registration_requests WHERE student_id=?',[applicant])[0]['course_id']=='free',
          'Anonymous registration retains the course choice')
    admin.post('user.toggle',{'id':applicant,'active':True})
    admin.post('user.toggle',{'id':applicant,'active':True})
    check(len(s.sql('SELECT id FROM enrollments WHERE student_id=?',[applicant]))==1,
          'Approval adds the selected free course once and a retry keeps the account active')
    # An existing email never allows a guest to add another course to that account.
    guest.post('register',{**form,'course_id':'paid'})
    check(len(s.sql('SELECT course_id FROM course_registration_requests WHERE student_id=?',[applicant]))==1,
          'Guest registration cannot change an existing learner enrollment intent')
    verified_form={**form,'email':'verified@example.test','verify_email':True}
    guest.post('register',verified_form)
    verified_id=s.sql('SELECT id FROM users WHERE email=?',[verified_form['email']])[0]['id']
    verification_link=s.php(['-r',"""require 'server/api.php';echo dec(one("SELECT link_path FROM email_outbox WHERE user_id=? AND kind='invitation'",[$argv[1]])['link_path']);""",verified_id]).stdout
    verifier=Client(s.base)
    verified=verifier.post('account.registration.verify',{'token':verification_link.split('#')[1]})
    check(verified['user']['id']==verified_id and verified['next']=='/courses/free' and
          s.sql('SELECT student_id FROM enrollments WHERE student_id=? AND course_id=?',[verified_id,'free']),
          'Public signup verifies email, signs the learner in and enrolls the chosen free course automatically')
    verifier.post('account.registration.verify',{'token':verification_link.split('#')[1]},410)
    check(True,'A verification link is single-use')
    # Explicit administrative creation remains separate from normal user creation.
    request={'name':'إدارة اختبار','email':'delegate@example.test','role':'admin','send_invite':True}
    teacher.post('user.save',request,403)
    admin.post('user.save',{**request,'current_password':'wrong'},422)
    delegated=admin.post('user.save',{**request,'current_password':s.password})['id']
    check(s.sql('SELECT role,active FROM users WHERE id=?',[delegated])[0]=={'role':'admin','active':0},
          'A new administrative account requires current admin password and starts as an unverified invitation')
    token=s.php(['-r',"""require 'server/api.php';echo dec(one("SELECT link_path FROM email_outbox WHERE user_id=? AND kind='invitation'",[$argv[1]])['link_path']);""",delegated]).stdout.split('#')[1]
    guest.post('account.registration.verify',{'token':token},403)
    guest.post('account.invite.accept',{'token':token,'password':s.password,'confirm':s.password,'consent':True})
    delegate=Client(s.base);delegate.post('login',{'email':request['email'],'password':s.password})
    check(delegate.get('data')['user']['role']=='admin','The invited administrator can verify email and sign in')
    delegate.post('trash.remove',{'kind':'account','id':'admin'},403)
    admin.post('trash.remove',{'kind':'account','id':'admin'},403)
    check(True,'Owner and current administrator cannot be removed')
    # A real PDF and a text lesson exercise authorized downloads and removal.
    pdf=b'%PDF-1.4\n% isolated resource\n%%EOF'
    f=teacher.upload(pdf,'practice.pdf','application/pdf','own')['id']
    lesson=teacher.post('lesson.save',{'course_id':'own','title':'درس ملف تجريبي','kind':'file','file_id':f,'duration':5})['id']
    q=teacher.post('quiz.save',{'course_id':'own','title':'اختبار تجريبي','minutes':10,'passing':50,'max_attempts':2,'questions':[{'text':'١ + ١ = ؟','options':['١','٢'],'correct':1}]})['id']
    assignment=teacher.post('assignment.save',{'course_id':'own','title':'واجب تجريبي','description':'اكتب تطبيقًا.',
        'due_at':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ'),'points':10})['id']
    now=datetime.datetime.now(datetime.timezone.utc)
    cl=teacher.post('class.save',{'course_id':'own','title':'حصة تجريبية','starts_at':(now-datetime.timedelta(minutes=1)).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'ends_at':(now+datetime.timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ'),'location':'زوم'})['id']
    notice=teacher.post('announcement.save',{'course_id':'own','title':'إعلان دورة','body':'للطلاب المسجلين فقط.'})['id']
    admin.post('announcement.save',{'title':'إعلان عام','body':'لجميع الحسابات.'})
    check({a['title'] for a in second.get('data')['announcements']}=={'إعلان عام'},
          'Only administrator general announcements reach an unenrolled account')
    for kind,rid,section in [('lesson',lesson,'lessons'),('quiz',q,'quizzes'),('assignment',assignment,'assignments'),('class',cl,'classes'),('announcement',notice,'announcements')]:
        student.post('trash.remove',{'kind':kind,'id':rid},403)
        other.post('trash.remove',{'kind':kind,'id':rid},403)
        teacher.post('trash.remove',{'kind':kind,'id':rid})
        teacher.post('trash.remove',{'kind':kind,'id':rid})
        check(not any(row['id']==rid for row in student.get('data')[section]),kind+' disappears from enrolled learner and is safe to retry')
        teacher.post('trash.restore',{'kind':kind,'id':rid},403)
        admin.post('trash.restore',{'kind':kind,'id':rid})
        check(any(row['id']==rid for row in student.get('data')[section]),kind+' is recoverable through administration')
    teacher.post('trash.remove',{'kind':'lesson','id':lesson})
    student.get('lesson&id='+lesson,404)
    check(not any(x['link_path'].endswith('?lesson='+lesson) for x in student.get('learning.updates')['items']),
          'Removed lessons are unavailable by direct link and their notifications disappear')
    teacher.post('trash.remove',{'kind':'file','id':f},409)
    check(True,'An attached file cannot be removed while a lesson still references it')
    admin.post('trash.restore',{'kind':'lesson','id':lesson})
    # Resources lose prior instructor ownership permissions after reassignment.
    s.sql("UPDATE courses SET instructor_id='other' WHERE id='own'")
    req=urllib.request.Request(s.base+'/api/index.php?action=file&id='+f)
    try:
        teacher.http.open(req,timeout=10);raise AssertionError('Former instructor could read course')
    except urllib.error.HTTPError as e:check(e.code==403,'Former instructor cannot read a resource after reassignment')
    s.sql("UPDATE courses SET instructor_id='instructor' WHERE id='own'")
    s.sql("INSERT INTO enrollments(id,student_id,course_id,created_at) VALUES('other-enrollment','student','foreign','2026-01-01T00:00:00Z')")
    counted = next(row for row in teacher.get('students.list')['items'] if row['id']=='student')
    check(int(counted['courses_count'])==2, 'Teacher directory counts the two assigned enrollments without exposing the foreign enrollment')
    admin.post('trash.remove',{'kind':'course','id':'own'})
    check(not any(row['id']=='own' for row in student.get('data')['courses']),'Removed course disappears with its training content')
    check(not any(row['id']==f for row in teacher.get('data')['files']), 'Archived course resources are hidden from its former course workspace')
    count_after = next(row for row in teacher.get('students.list')['items'] if row['id']=='student')
    check(int(count_after['courses_count'])==1, 'Archived courses stop contributing to teacher roster totals')
    student.get('lesson&id='+lesson,404)
    admin.post('trash.restore',{'kind':'course','id':'own'})
    check(any(row['id']=='own' for row in student.get('data')['courses']),'Course restoration preserves enrollment')
    admin.post('trash.remove',{'kind':'account','id':'student'})
    student.get('data',401)
    check(not any(row['id']=='student' for row in teacher.get('data')['students']),'Removed learner session is invalidated and class roster hides the account')
    admin.post('trash.restore',{'kind':'account','id':'student'})
    check(s.login('student').get('data')['user']['role']=='student','A restored learner retains the original role')
    s.php(['-r',"""require 'server/api.php';
    run('INSERT INTO learning_paths(id,title,description,level,goals,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
        ['archive-path','مسار حذف','وصف','مبتدئ','هدف','published',now(),now()]);
    run('INSERT INTO learning_bags(id,course_id,title,description,version,updated_at) VALUES(?,?,?,?,?,?)',
        ['archive-bag','own','حقيبة حذف','وصف','1',now()]);
    run('INSERT INTO video_assets(id,course_id,provider_id,title,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
        ['archive-video','own','isolated-video','فيديو حذف','ready','admin',now(),now()]);
    run('INSERT INTO certificates(id,course_id,student_id,serial,issued_at) VALUES(?,?,?,?,?)',
        ['archive-cert','own','student','ARCHIVE-CERTIFICATE',now()]);
    run('INSERT INTO support(id,user_id,subject,body,status,created_at) VALUES(?,?,?,?,?,?)',
        ['archive-support','student','دعم حذف','تجربة','open',now()]);
    """])
    for kind,rid in [('path','archive-path'),('bag','archive-bag'),('video','archive-video'),('certificate','archive-cert'),('support','archive-support')]:
        admin.post('trash.remove',{'kind':kind,'id':rid})
        assert any(row['resource_id']==rid for row in admin.get('trash.list')['items'])
        admin.post('trash.restore',{'kind':kind,'id':rid})
        assert not any(row['resource_id']==rid for row in admin.get('trash.list')['items'])
    check(True,'Paths, bags, unlinked cloud videos, certificates and support tickets can be removed and restored')
    report={'passed':len(checks),'failed':0,'database':'MariaDB' if s.mysql else 'SQLite','checks':checks}
    (ROOT/'output/experience-20261118'/('experience-'+report['database'].lower()+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('DONE',len(checks),'checks')
