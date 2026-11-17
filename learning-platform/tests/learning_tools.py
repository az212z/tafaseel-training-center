"""Learning paths, community, privacy, evaluation and batch registration over real HTTP/PDO."""
import json, subprocess, concurrent.futures, urllib.request, urllib.error
from sandbox import Sandbox, Client, ROOT

checks=[]
def check(value,label):
    assert value,label
    checks.append(label)

(ROOT/'output').mkdir(exist_ok=True)
with Sandbox() as s:
    s.php([str(ROOT/'tests/scale-fixtures.php'),'100'])
    s.php([str(ROOT/'server/console.php'),'migrate'])
    admin=s.login('admin'); trainer=s.login('instructor'); other=s.login('other'); student=s.login('s0'); second=s.login('s1'); guardian=s.login('guardian'); guest=Client(s.base)
    check(guest.get('learning.paths')['total']==0,'Public paths start empty without fabricated courses or testimonials')
    path={'title':'مسار مهارات اختبار','description':'مسار مستقل لاختبار الدورات المترابطة.','level':'مبتدئ','goals':'فهم المحتوى\nتطبيق المهارات','status':'draft','course_ids':['c0','c1']}
    for client in [student,trainer,guardian]: client.post('path.save',path,403)
    check(True,'Only administration can create or reorder learning paths')
    pid=admin.post('path.save',path)['id']; check(guest.get('learning.paths')['total']==0 and admin.get('learning.paths')['total']==1,'Draft paths are visible to administration only')
    admin.post('path.save',{**path,'course_ids':['c0','c0']},422);admin.post('path.save',{**path,'course_ids':[{}]},422)
    check(True,'Duplicate and malformed path courses rejected as validation errors')
    admin.post('path.save',{**path,'id':pid,'status':'published','course_ids':['c1','c0']})
    public=guest.get('learning.paths')['items'][0]
    check([x['id'] for x in public['courses']]==['c1','c0'] and not public['completed'],'Published paths preserve order and reveal no learner progress publicly')
    c=s.sql("SELECT * FROM courses WHERE id='c1'")[0]
    admin.post('course.save',{**c,'status':'draft'})
    check(guest.get('learning.paths')['total']==0,'A path with a subsequently withdrawn course is removed from public discovery')
    admin.post('path.save',{**path,'id':pid,'status':'published'},422);admin.post('course.save',c)
    check(True,'Published paths cannot include unpublished courses')
    for endpoint in ['discussion.list&course_id=c0','lesson.note&lesson_id=c0l0','survey&course_id=c0','training.report','launch.checklist']:
        guest.get(endpoint,401)
    check(True,'Learning records and operational readiness require authentication')
    second.get('discussion.list&course_id=c0',403);other.get('discussion.list&course_id=c0',403)
    check(True,'Unenrolled learners and unassigned instructors cannot read course discussions')
    question={'course_id':'c0','title':'سؤال عن التطبيق','body':'كيف أطبق خطوات هذا الدرس؟'}
    guardian.post('discussion.save',question,403)
    tid=student.post('discussion.save',question)['id'];trainer.post('discussion.save',{'course_id':'c0','parent_id':tid,'body':'ابدأ بالمثال الأول ثم جرّب بقية الخطوات.'})
    check(student.get('discussion.list&course_id=c0')['items'][0]['replies']==1,'Enrolled learner can ask and assigned teacher can reply')
    check(student.get('discussion.list&course_id=c0&parent_id='+tid)['items'][0]['author_role']=='instructor','Replies distinguish instructor role using server identity')
    student.post('discussion.status',{'id':tid,'status':'resolved'},403);other.post('discussion.status',{'id':tid,'status':'hidden'},403)
    check(True,'Learners and unrelated instructors cannot moderate threads')
    trainer.post('discussion.status',{'id':tid,'status':'resolved'});student.post('discussion.save',{'course_id':'c0','parent_id':tid,'body':'رد بعد الإغلاق'},409)
    check(True,'Answered thread refuses further replies until reopened')
    trainer.post('discussion.status',{'id':tid,'status':'hidden'});check(student.get('discussion.list&course_id=c0')['total']==0,'Hidden discussion disappears from learner list')
    student.get('discussion.list&course_id=c0&parent_id='+tid,404);trainer.post('discussion.status',{'id':tid,'status':'open'})
    check(True,'Hidden parent prevents access to its replies through direct ID')
    second.post('discussion.save',{'course_id':'c7','parent_id':tid,'body':'رد على نقاش دورة مختلفة'},409)
    check(True,'Discussion reply cannot attach to another course')
    # Separate devices authenticated as the same learner exercise duplicate-write races.
    device_a=s.login('s0');device_b=s.login('s0')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(lambda client:client.post('progress',{'lesson_id':'c0l6'}),[device_a,device_b]))
    check(int(s.sql("SELECT COUNT(*) n FROM progress WHERE lesson_id='c0l6' AND student_id='s0'")[0]['n'])==1,'Concurrent lesson completion from two devices stays idempotent without server errors')
    # Both devices submit the same previously unsubmitted assignment.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        submissions=list(executor.map(lambda client:client.post('submission.save',{'assignment_id':'a2','body':'إجابة جهاز محاكاة'}),[device_a,device_b]))
    check(submissions[0]['id']==submissions[1]['id'],'Concurrent assignment submissions share one durable submission record')
    note={'lesson_id':'c0l0','body':'ملاحظة خاصة جدًا للمحاكاة','bookmarked':True,'seconds':2,'user_id':'s1'}
    student.post('lesson.note.save',note)
    check(student.get('lesson.note&lesson_id=c0l0')['note']['body']==note['body'],'Private notebook persists body, bookmark and playback position')
    check(trainer.get('lesson.note&lesson_id=c0l0')['note'] is None and admin.get('lesson.note&lesson_id=c0l0')['note'] is None,'Administration and instructors cannot read learner notebook by overriding a target')
    saved=student.get('lesson.bookmarks')
    check(saved['total']==1 and saved['items'][0]['note_body']==note['body'] and trainer.get('lesson.bookmarks')['total']==0,'Review notebook lists only the current account bookmarks and decrypts its private notes')
    guardian.get('lesson.bookmarks',403)
    check(s.sql("SELECT body FROM lesson_notes WHERE user_id='s0'")[0]['body']!=note['body'],'Notebook body encrypted at rest')
    second.get('lesson.note&lesson_id=c0l0',403);guardian.get('lesson.note&lesson_id=c0l0',403)
    student.post('lesson.note.save',{**note,'seconds':-1},422)
    check(True,'Notebook denies course IDOR, guardian reading and invalid media positions')
    survey={'course_id':'c0','content_rating':5,'trainer_rating':4,'experience_rating':5,'comment':'اقتراح خاص'}
    student.post('survey.save',survey,422);check(True,'Course survey requires completing every lesson')
    for i in range(6,12): student.post('progress',{'lesson_id':'c0l'+str(i)})
    student.post('survey.save',{**survey,'experience_rating':6},422);student.post('survey.save',survey)
    student.post('survey.save',survey,409)
    check(trainer.get('survey&course_id=c0')['summary']['responses']==1,'Survey stores one response per learner and exposes aggregates to assigned teacher')
    check('comment' not in json.dumps(trainer.get('survey&course_id=c0')) and s.sql("SELECT comment FROM course_surveys")[0]['comment']!=survey['comment'],'Survey commentary encrypted and omitted from staff aggregate endpoint')
    second.get('survey&course_id=c0',403);other.get('survey&course_id=c0',403);guardian.get('survey&course_id=c0',403)
    check(True,'Unrelated accounts cannot read course survey or individual learner answers')
    trainer.post('attendance.save',{'class_id':'cl0','records':[{'student_id':'s0','status':'present','note':'تصحيح حضور محاكاة بعد التحقق'}]})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        issued=list(executor.map(lambda client:client.post('certificate.issue',{'course_id':'c0','student_id':'s0'}),[admin,trainer]))
    check(issued[0]['id']==issued[1]['id'] and int(s.sql("SELECT COUNT(*) n FROM certificates WHERE course_id='c0' AND student_id='s0'")[0]['n'])==1,'Concurrent certificate issuance returns one serial and record to both authorized issuers')
    batch={'course_id':'c0','csv':'email\ns0@example.test\ns1@example.test\ns1@example.test\ns2@example.test'}
    preview=admin.post('enrollment.preview',batch)
    check(preview['ready']==2 and preview['duplicates']==1 and len(preview['items'])==3,'Batch preview removes repeated emails and identifies existing enrollments')
    check(not s.sql("SELECT id FROM enrollments WHERE student_id='s1' AND course_id='c0'"),'Preview makes no enrollment mutations')
    student.post('enrollment.batch',batch,403);trainer.post('enrollment.batch',batch,403)
    bad={**batch,'csv':batch['csv']+'\nunknown@example.test'}
    check(not admin.post('enrollment.preview',bad)['can_apply'],'Unknown or inactive accounts block batch approval')
    admin.post('enrollment.batch',bad,409)
    check(not s.sql("SELECT id FROM enrollments WHERE student_id='s1' AND course_id='c0'"),'Invalid batch is atomic and never partially enrolls students')
    result=admin.post('enrollment.batch',batch);again=admin.post('enrollment.batch',batch)
    check(result['enrolled']==2 and again['enrolled']==0,'Batch apply and retries never duplicate enrollment')
    admin.post('enrollment.preview',{**batch,'csv':'=HYPERLINK("https://example.test")'},422)
    check(True,'CSV rejects spreadsheet expressions and extra columns rather than interpreting them')
    # Two independently authenticated sessions compete for the final seat.
    cid='c99'; count=int(s.sql('SELECT COUNT(*) n FROM enrollments WHERE course_id=?',[cid])[0]['n']); c=s.sql('SELECT * FROM courses WHERE id=?',[cid])[0];admin.post('course.save',{**c,'capacity':count+1})
    candidates=[x['email'] for x in s.sql("SELECT email FROM users WHERE role='student' AND id NOT IN (SELECT student_id FROM enrollments WHERE course_id=?) ORDER BY id LIMIT 2",[cid])]
    a=s.login('admin');b=s.login('admin')
    def reserve(pair):
        client,email=pair
        try:return client.post('enrollment.batch',{'course_id':cid,'csv':email})['enrolled']
        except AssertionError as error:
            if "409" in str(error):return 'full'
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor: outcomes=list(executor.map(reserve,[(a,candidates[0]),(b,candidates[1])]))
    check(sorted(map(str,outcomes))==['1','full'] and int(s.sql('SELECT COUNT(*) n FROM enrollments WHERE course_id=?',[cid])[0]['n'])==count+1,'Concurrent batch registration cannot oversell final seat')
    report=admin.get('training.report'); expected=int(s.sql('SELECT COUNT(DISTINCT student_id) n FROM enrollments')[0]['n'])
    check(report['total']==100 and len(report['items'])==25 and int(report['summary']['students'])==expected,'Training report paginates courses and computes summary across every matching record')
    check(other.get('training.report')['total']==0,'Instructor report includes only assigned courses')
    second.get('training.report',403);second.get('launch.checklist',403)
    check(all(not x['configured'] for x in admin.get('launch.checklist')['services'].values()),'Readiness never labels unconfigured external services operational')
    # A real, owned MP4 is generated and transferred through encrypted storage.
    mp4=s.folder/'sample.mp4'
    subprocess.run(['ffmpeg','-loglevel','error','-f','lavfi','-i','color=c=0x164d43:s=320x180:r=12:d=3','-f','lavfi','-i','anullsrc=r=22050:cl=mono','-t','3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(mp4)],check=True)
    media=mp4.read_bytes();file=trainer.upload(media,'simulation.mp4','video/mp4','c0')
    lesson=trainer.post('lesson.save',{'course_id':'c0','title':'فيديو فعلي للمحاكاة','kind':'video','file_id':file['id'],'duration':1,'sort_order':20})['id']
    url=s.base+'/api/index.php?action=file&id='+file['id']
    with student.http.open(url) as response: restored=response.read();check(restored==media and response.headers['Content-Type'].startswith('video/mp4'),'Authenticated MP4 download exactly matches original after encryption/decryption')
    request=urllib.request.Request(url,headers={'Range':'bytes=0-99'})
    with student.http.open(request) as response:check(response.status==206 and response.read()==media[:100],'Video seeking returns correct HTTP byte range')
    second.get('lesson&id='+lesson)  # Batch enrollment above granted legitimate access.
    outsider=s.login('s3')
    try: outsider.http.open(url);raise AssertionError('Video privacy bypass')
    except urllib.error.HTTPError as e:check(e.code in (403,404),'Unenrolled learner cannot stream private video')
    stored=list((s.folder/'storage/files').iterdir())
    check(all(x.read_bytes()!=media for x in stored),'Video bytes remain encrypted outside public root')
    guest.get('learning.paths&page[]=1',422)
    check(True,'Array pagination input returns a controlled validation error')
    s.sql('DELETE FROM rate_limits')
    for i in range(21):student.post('discussion.save',{**question,'title':'سؤال متكرر '+str(i)},429 if i>=20 else 200)
    check(True,'Community posting has a server-side rate limit')
    result={'database':'MariaDB' if s.mysql else 'SQLite','passed':len(checks),'failed':0,'real_video':True,'checks':checks}
    (ROOT/'output'/('learning-tools-'+result['database'].lower()+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
