"""Real quiz authoring/attempt regressions in a disposable database; no production traffic."""
import copy,json
from sandbox import Sandbox, ROOT

checks=[]
def check(value,label):
    assert value,label
    checks.append(label);print('PASS '+label,flush=True)

with Sandbox() as s:
    s.php(['-r', "require 'server/api.php';foreach(['admin'=>'admin','instructor'=>'instructor','student'=>'student','other'=>'instructor'] as $id=>$role)run('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)',[$id,$id,$id.'@example.test',password_hash(getenv('TAFASEEL_SIM_PASSWORD'),PASSWORD_DEFAULT),$role,now()]);run('INSERT INTO courses(id,title,description,category,image,status,instructor_id,created_at) VALUES(?,?,?,?,?,?,?,?)',['course','دورة المحاكاة','محتوى المحاكاة','عام','/images/courses/foundation.webp','published','instructor',now()]);run('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)',['enrollment','course','student',now()]);"])
    admin=s.login('admin');trainer=s.login('instructor');student=s.login('student');other=s.login('other')
    base={'course_id':'course','title':'اختبار الأرقام','minutes':30,'passing':60,'max_attempts':2,'questions':[{'text':'٢ + ٢ = ؟','options':['٢','٣','٤','٥'],'correct':2}]}
    for options in [['٢','٣','٤','٥'],['0','1','2','3'],['أ','ب','ج','د'],['A','B','C','D']]:
        payload=copy.deepcopy(base);payload['questions'][0]['options']=options
        created=admin.post('quiz.save',payload)
        stored=admin.get('quiz&id='+created['id'])['quiz']
        check(stored['questions']==payload['questions'],'Administrator can create and retrieve single-character answers: '+','.join(options))
    created=trainer.post('quiz.save',base)
    check(trainer.get('quiz&id='+created['id'])['quiz']['questions']==base['questions'],'Assigned instructor can create and retrieve the same short-answer quiz')
    attempt=student.post('quiz.start',{'id':created['id']})
    view=student.get('quiz.attempt&id='+attempt['id'])['attempt']
    check(all('correct' not in q for q in view['questions']),'Student sees short answer choices without the answer key')
    score=student.post('quiz.submit',{'id':attempt['id'],'answers':[2],'score':999})
    check(score['score']==1 and score['total']==1,'Short answer choices are graded correctly by the server')
    trimmed=copy.deepcopy(base);trimmed['questions'][0]['options']=[' ١ ',' ٢ ',' ٣ ',' ٤ ']
    trimmed_id=trainer.post('quiz.save',trimmed)['id']
    check(trainer.get('quiz&id='+trimmed_id)['quiz']['questions'][0]['options']==['١','٢','٣','٤'],'Whitespace is trimmed without rejecting a one-character answer')
    boundary=copy.deepcopy(base);boundary['title']='ت'*200;boundary['questions'][0]['text']='س'*1000;boundary['questions'][0]['options']=['خ'*500,'٢'];boundary['questions'][0]['correct']=1
    boundary_id=trainer.post('quiz.save',boundary)['id']
    check(trainer.get('quiz&id='+boundary_id)['quiz']['questions']==boundary['questions'],'Quiz title, question and answer maximum lengths remain supported')
    before=len(s.sql('SELECT id FROM quizzes'))
    invalid=[]
    for label,edit,fragment in [
        ('blank option',lambda p:p['questions'][0]['options'].__setitem__(1,' '),'الخيار 2 في السؤال 1'),
        ('oversized option',lambda p:p['questions'][0]['options'].__setitem__(2,'خ'*501),'الخيار 3 في السؤال 1'),
        ('non-text option',lambda p:p['questions'][0]['options'].__setitem__(0,1),'الخيار 1 في السؤال 1'),
        ('blank question',lambda p:p['questions'][0].__setitem__('text',' '),'نص السؤال 1'),
        ('oversized question',lambda p:p['questions'][0].__setitem__('text','س'*1001),'نص السؤال 1'),
        ('oversized title',lambda p:p.__setitem__('title','ت'*201),'اسم الاختبار'),
        ('one-character title',lambda p:p.__setitem__('title','ت'),'اسم الاختبار'),
        ('missing title',lambda p:p.__setitem__('title',''),'اسم الاختبار'),
        ('invalid answer key',lambda p:p['questions'][0].__setitem__('correct',4),'الصحيحة للسؤال 1'),
        ('malformed question',lambda p:p['questions'].__setitem__(0,None),'السؤال 1'),
    ]:
        payload=copy.deepcopy(base);edit(payload);result=trainer.post('quiz.save',payload,422)
        check(fragment in result['error'],'Invalid '+label+' identifies its field instead of a generic length error')
    check(len(s.sql('SELECT id FROM quizzes'))==before,'Rejected quizzes never leave a partially created quiz')
    student.post('quiz.save',base,403);other.post('quiz.save',base,403)
    check(True,'Student and unrelated instructor cannot create a quiz in this course')
    report={'database':'MariaDB' if s.mysql else 'SQLite','passed':len(checks),'failed':0,'checks':checks,'production_data_used':False}
    name='quiz-validation-qa.json' if s.mysql else 'quiz-validation-qa-sqlite.json'
    (ROOT/'docs'/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('DONE '+str(len(checks))+' checks')
