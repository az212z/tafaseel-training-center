"""Regression checks for document ownership changes, archived coursework and large file metadata."""
import time
from sandbox import Sandbox

with Sandbox() as s:
    s.php(['-r', """require 'server/api.php';
        $pw=password_hash(getenv('TAFASEEL_SIM_PASSWORD'), PASSWORD_DEFAULT);
        foreach (['admin'=>'admin','teacher'=>'instructor','learner'=>'student','guardian'=>'guardian','newguardian'=>'guardian'] as $id=>$role) {
            run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$pw,$role,now()]);
        }
        run("INSERT INTO profiles(user_id,guardian_id,consent_at) VALUES('learner','guardian',?)",[now()]);
        run("INSERT INTO files(id,owner_id,student_id,purpose,name,mime,bytes,storage_name,created_at) VALUES('doc','guardian','learner','identity','fixture.pdf','application/pdf',1,'fixture',?)",[now()]);
        run("INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES('course','دورة تجريبية','تعليم','تدريب','img','published','teacher',?)",[now()]);
        run("INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES('en','course','learner',?)",[now()]);
    """])
    admin, teacher, learner, former, current = [s.login(k) for k in ('admin','teacher','learner','guardian','newguardian')]
    def documents(user):
        return {f['id'] for f in user.get('data')['files']}
    assert 'doc' in documents(former)
    s.sql("UPDATE profiles SET guardian_id='newguardian' WHERE user_id='learner'")
    assert 'doc' not in documents(former)
    former.get('file.info&id=doc',403)
    for user in [admin, learner, current]:
        assert 'doc' in documents(user) and user.get('file.info&id=doc')['id']=='doc'
    quiz=teacher.post('quiz.save',dict(course_id='course',title='اختبار تجريبي',minutes=30,passing=50,max_attempts=2,
         questions=[dict(text='اختر العدد الأكبر',options=['١','٢'],correct=1)]))['id']
    attempt=learner.post('quiz.start',dict(id=quiz))['id']
    change=dict(id=attempt,changes=[dict(question=0,answer=1)])
    learner.post('quiz.answers.save',change)
    teacher.post('trash.remove',dict(kind='quiz',id=quiz))
    learner.get('quiz.attempt&id='+attempt,410)
    learner.post('quiz.answers.save',change,410)
    learner.post('quiz.submit',dict(id=attempt,use_saved_answers=True),410)
    admin.post('trash.restore',dict(kind='quiz',id=quiz))
    assert learner.get('quiz.attempt&id='+attempt)['draft']['answers']==[1]
    a=teacher.post('assignment.save',dict(course_id='course',title='واجب تدريبي',description='ارفع الحل',points=10,due_at='2090-01-01T00:00:00Z'))['id']
    sub=learner.post('submission.save',dict(assignment_id=a,body='الإجابة'))['id']
    grade=dict(id=sub,score=8,feedback='جيد')
    teacher.post('submission.grade',grade)
    teacher.post('trash.remove',dict(kind='assignment',id=a))
    teacher.post('submission.grade',dict(grade,score=9),404)
    assert int(teacher.get('training.report')['items'][0]['graded'])==0
    assert int(teacher.get('training.report&include_archived=1')['items'][0]['graded'])==1
    admin.post('trash.remove',dict(kind='course',id='course'))
    assert not teacher.get('training.report')['items']
    assert len(teacher.get('training.report&include_archived=1')['items'])==1
    for key,expires in [('old',0),('active',int(time.time())+3600)]:
        s.sql('INSERT INTO rate_limits(bucket,hits,expires) VALUES(?,1,?)',[key,expires])
    s.php(['-r',"require 'server/api.php'; pruneExpiredRateLimits();"])
    assert not s.sql("SELECT bucket FROM rate_limits WHERE bucket='old'")
    assert s.sql("SELECT bucket FROM rate_limits WHERE bucket='active'")
    s.sql("UPDATE files SET bytes=? WHERE id='doc'",[10*1024**3])
    assert int(s.sql("SELECT bytes FROM files WHERE id='doc'")[0]['bytes'])==10*1024**3
    print('PASS: guardian reassignment, saved attempts, archive grading/reports, bounded cleanup and 64-bit sizes')

# A password-version change invalidates pending staff sign-ins as well as signed-in sessions.
with Sandbox(config_overrides={'staff_mfa_enabled': True}) as s:
    import base64, hashlib, hmac, struct
    from sandbox import Client
    s.php(['-r', """require 'server/api.php';
        $pw=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);
        run("INSERT INTO users(id,name,email,role,password,mfa_secret,created_at) VALUES('staff','staff','staff@example.test','instructor',?,?,?)",[$pw,enc('JBSWY3DPEHPK3PXP'),now()]);
    """])
    def start():
        c=Client(s.base)
        assert c.post('login',{'email':'staff@example.test','password':s.password})['mfaRequired']
        return c
    def code():
        digest=hmac.new(base64.b32decode('JBSWY3DPEHPK3PXP'),struct.pack('>Q',int(time.time()//30)),hashlib.sha1).digest()
        i=digest[-1]&15
        return str((int.from_bytes(digest[i:i+4],'big')&0x7fffffff)%1000000).zfill(6)
    stale=start()
    s.sql("UPDATE users SET auth_version=auth_version+1 WHERE id='staff'")
    stale.post('login.mfa',{'code':code()},401)
    first,second=start(),start()
    token=code()
    assert first.post('login.mfa',{'code':token})['user']['id']=='staff'
    second.post('login.mfa',{'code':token},401)
    print('PASS: pending sign-in version and single-use verification')
