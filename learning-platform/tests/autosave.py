"""Owned quiz draft persistence, concurrency and deadline regressions; isolated data only."""
import concurrent.futures, datetime, json
from sandbox import Sandbox, ROOT

checks=[]
def check(value,label):
    assert value,label
    checks.append(label); print('PASS '+label,flush=True)

with Sandbox() as s:
    s.php(['-r', "require 'server/api.php';$hash=password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT);foreach(['admin'=>'admin','instructor'=>'instructor','student'=>'student','second'=>'student'] as $id=>$role)run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',$hash,$role,now()]);run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES(?,?,?,?,?,?,?,?)',['course','دورة المراجعة','محتوى معزول','عام','/images/courses/foundation.webp','published','instructor',now()]);run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',['enroll','course','student',now()]);"])
    admin=s.login('admin');teacher=s.login('instructor');student=s.login('student');second=s.login('second')
    q={'course_id':'course','title':'اختبار الحفظ','minutes':30,'passing':50,'max_attempts':5,'questions':[{'text':'٢ + ٢ = ؟','options':['٢','٣','٤','٥'],'correct':2},{'text':'١ + ١ = ؟','options':['١','٢','٣'],'correct':1}]}
    quiz=teacher.post('quiz.save',q)['id'];attempt=student.post('quiz.start',{'id':quiz})['id']
    before=student.get('quiz.attempt&id='+attempt)
    saved=student.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':2}]})
    restored=s.login('student').get('quiz.attempt&id='+attempt)
    check(restored['draft']['answers']==[2,None] and restored['attempt']['expires_at']==before['attempt']['expires_at'],'A saved answer survives a fresh authenticated client without resetting the exam deadline')
    check(all('correct' not in x for x in restored['attempt']['questions']) and 'answers' not in restored['attempt'],'Draft restoration never exposes the grading key or raw attempt storage')
    stored=s.sql('SELECT answers FROM quiz_answer_drafts WHERE attempt_id=?',[attempt])[0]['answers']
    check(stored!='[2,null]' and stored!='[2, null]','Draft answers are encrypted at rest')
    again=student.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':2}]})
    check(again['draft']['revision']==saved['draft']['revision'],'Retrying the same saved answer is idempotent')
    other_tab=s.login('student')
    other_tab.post('quiz.answers.save',{'id':attempt,'changes':[{'question':1,'answer':1}]})
    student.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':0}]})
    check(student.get('quiz.attempt&id='+attempt)['draft']['answers']==[0,1],'A stale tab changing one question preserves another tab answer to a different question')
    clients=[s.login('student'),s.login('student')]
    def change(pair):
        i,c=pair
        return c.post('quiz.answers.save',{'id':attempt,'changes':[{'question':i,'answer':[2,1][i]}]})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(change,enumerate(clients)))
    check(student.get('quiz.attempt&id='+attempt)['draft']['answers']==[2,1],'Concurrent question patches merge atomically without losing either answer')
    for invalid in [None,[],[{'question':0,'answer':True}],[{'question':-1,'answer':0}],[{'question':2,'answer':0}],[{'question':0,'answer':4}],[{'question':'0','answer':0}],[{'question':0,'answer':'2'}],[{'question':0,'answer':1},{'question':0,'answer':2}]]:
        student.post('quiz.answers.save',{'id':attempt,'changes':invalid},422)
    check(student.get('quiz.attempt&id='+attempt)['draft']['answers']==[2,1],'Malformed or duplicate question patches fail atomically without altering the saved draft')
    second.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':0}]},404)
    teacher.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':0}]},403)
    student.get('quiz.answers.save&id='+attempt,405)
    student.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':0}]},403,{'X-CSRF-Token':'invalid'})
    check(True,'Answer saving requires attempt ownership, student role, POST and CSRF')
    s.sql("UPDATE courses SET status='draft' WHERE id='course'")
    student.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':0}]},404)
    s.sql("UPDATE courses SET status='published' WHERE id='course'")
    result=student.post('quiz.submit',{'id':attempt,'use_saved_answers':True,'answers':[0,0],'score':999})
    check(result['score']==2 and result['total']==2,'Submitting a saved attempt grades the server draft and ignores contradictory client score or answers')
    student.post('quiz.answers.save',{'id':attempt,'changes':[{'question':0,'answer':0}]},409)
    check(student.post('quiz.submit',{'id':attempt,'answers':[0,0]})['score']==2,'Submitted attempts reject later autosaves and repeated submission cannot change the result')
    quiz2=teacher.post('quiz.save',q)['id'];late=student.post('quiz.start',{'id':quiz2})['id']
    student.post('quiz.answers.save',{'id':late,'changes':[{'question':0,'answer':2}]})
    expired=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    s.sql('UPDATE attempts SET expires_at=? WHERE id=?',[expired,late])
    student.post('quiz.answers.save',{'id':late,'changes':[{'question':1,'answer':1}]},409)
    result=student.post('quiz.submit',{'id':late,'use_saved_answers':True,'answers':[2,1]})
    check(result['expired'] and result['score']==1 and result['used_saved_answers'],'After time expires only answers saved during the attempt are graded; late answers cannot be added')
    stamp=lambda seconds:(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)).strftime('%Y-%m-%dT%H:%M:%SZ')
    session=teacher.post('class.save',{'course_id':'course','title':'رصد الحضور','starts_at':stamp(-60),'ends_at':stamp(3600),'location':'اختبار محلي','automatic_absence':True,'attendance_mode':'manual'})['id']
    present={'student_id':'student','status':'present','note':'','expected_status':None}
    teacher.post('attendance.save',{'class_id':session,'autosave':True,'records':[present]})
    row=s.sql('SELECT * FROM attendance WHERE class_id=?',[session])[0]
    teacher.post('attendance.save',{'class_id':session,'autosave':True,'records':[present]})
    check(s.sql('SELECT * FROM attendance WHERE class_id=?',[session])[0]==row,'An attendance autosave survives a fresh read and a lost-response retry does not require a correction reason or change the record')
    correction={'student_id':'student','status':'late','note':'','expected_status':'present'}
    teacher.post('attendance.save',{'class_id':session,'autosave':True,'records':[correction]},422)
    teacher.post('attendance.save',{'class_id':session,'autosave':True,'records':[{**correction,'note':'مراجعة وقت وصول الطالب'}]})
    check(s.sql('SELECT status FROM attendance WHERE class_id=?',[session])[0]['status']=='late','Changing previously saved attendance still requires an explicit correction reason')
    teacher.post('attendance.save',{'class_id':session,'autosave':True,'records':[{**correction,'status':'absent','note':'قراءة قديمة من نافذة أخرى'}]},409)
    check(s.sql('SELECT status FROM attendance WHERE class_id=?',[session])[0]['status']=='late','A stale attendance autosave cannot overwrite another confirmed decision')
    teacher.post('class.attendance.control',{'class_id':session,'command':'start','mode':'manual'})
    s.sql('UPDATE classes SET starts_at=? WHERE id=?',[stamp(-1201),session])
    s.sql('UPDATE class_attendance_automation SET started_at=? WHERE class_id=?',[stamp(-1201),session])
    s.php(['server/console.php','worker'])
    check(s.sql('SELECT status FROM attendance WHERE class_id=?',[session])[0]['status']=='late','Attendance already confirmed by autosave remains protected when the twenty-minute absence worker runs')
    report={'database':'MariaDB' if s.mysql else 'SQLite','passed':len(checks),'failed':0,'checks':checks,'production_data_used':False}
    (ROOT/'output'/('autosave-'+report['database'].lower()+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('DONE '+str(len(checks))+' checks')
