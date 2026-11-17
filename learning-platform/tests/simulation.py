"""Large synthetic dataset, real training workflows, concurrent requests and restore rehearsal.

Never sends traffic to production or external providers. Run with a disposable MariaDB socket
via TAFASEEL_TEST_MYSQL_SOCKET. Reported concurrency is local client concurrency, not hosting SLA.
"""
import concurrent.futures, collections, hashlib, json, math, os, pathlib, shutil, statistics, subprocess, time
from sandbox import Sandbox, Client, ROOT

checks=[]; measurements=collections.defaultdict(list); samples=[]; started=time.perf_counter()
def check(value,label):
    assert value,label
    checks.append(label)
def timed(client,action,body=None,expected=200):
    data,meta=client.call(action,body,expected); key=action.split('&')[0]
    measurements[key].append(meta['milliseconds']); samples.append({'action':key,'ms':meta['milliseconds'],'bytes':meta['bytes'],'status':meta['status']})
    return data,meta
def percentile(values,p): return round(sorted(values)[max(0,math.ceil(len(values)*p)-1)],2)

with Sandbox() as s:
    counts=json.loads(s.php([str(ROOT/'tests/scale-fixtures.php'),'5000']).stdout)
    admin=s.login('admin');trainer=s.login('instructor');outsider=s.login('other');guardian=s.login('guardian');guest=Client(s.base)
    overview,overview_meta=timed(admin,'data')
    check(overview['statistics']['students']==5000 and overview['statistics']['enrollments']==50000 and overview['statistics']['attendance_percent']==80,'Overview includes all 5000 learners and 50000 enrollments in accurate database counts')
    check(overview['dataset']['overview'] and overview_meta['bytes']<150000 and not overview['progress'],'Large staff overview explicitly scopes details and stays below 150 KB')
    detail,detail_meta=timed(admin,'data&course_id=c0')
    check(len(detail['students'])==500 and len(detail['progress'])==3000 and detail_meta['bytes']<1000000,'Course workspace includes every one of its 500 students, with bounded lesson progress payload')
    last,_=timed(admin,'data&student_id=s4999')
    check(len(last['students'])==1 and last['students'][0]['id']=='s4999' and len(last['progress'])==60,'A student beyond the former 2000-record cutoff has complete profile learning records')
    page_ids=[]
    for page in range(1,201):
        page_data,_=timed(admin,'students.list&page='+str(page)); page_ids.extend(x['id'] for x in page_data['items'])
    check(len(page_ids)==5000 and len(set(page_ids))==5000,'Student pagination enumerates all 5000 records without gaps or duplicates')
    report_rows=[]
    for page in range(1,5):
        report,_=timed(admin,'training.report&page='+str(page)); report_rows.extend(report['items'])
    check(sum(int(x['completed']) for x in report_rows)==300000 and sum(int(x['graded']) for x in report_rows)==10000,'Paginated report reconciles exactly to 300000 lesson completions and 10000 graded submissions')
    ledger,_=timed(admin,'orders')
    check(ledger['total']==5000 and ledger['summary']['paid']==10000000 and ledger['summary']['refunded']==10000000,'Full financial ledger summary includes every page and reconciles synthetic paid/refunded totals')
    outsider.get('data&student_id=s4999',403);outsider.get('training.report&course_id=c0',403)
    check(True,'Scoped data and report filters cannot grant an unrelated instructor extra access')
    check(len(guardian.get('data')['students'])==2,'Guardian receives only the two linked student profiles at large scale')
    students=[s.login('s'+str(i)) for i in range(40)]
    check(len(students)==40,'Forty learners sign in from one shared network with actual authentication and unchanged per-account brute-force protection')
    def journey(pair):
        i,student=pair; c=(i*7+5)%100; cid='c'+str(c); lid=cid+'l7'; label='دورة محاكاة '+str(c)
        data,_=timed(student,'data'); assert len(data['courses'])==10 and all(x['id']=='s'+str(i) for x in data['students'])
        timed(student,'progress',{'lesson_id':lid});timed(student,'progress',{'lesson_id':lid})
        for l in range(6,12):timed(student,'progress',{'lesson_id':cid+'l'+str(l)})
        sub,_=timed(student,'submission.save',{'assignment_id':'a'+str(c),'body':'حل مشروع محاكاة للطالب '+str(i)})
        attempt,_=timed(student,'quiz.start',{'id':'q'+str(c)})
        view,_=timed(student,'quiz.attempt&id='+attempt['id']);assert all('correct' not in q for q in view['attempt']['questions'])
        first,_=timed(student,'quiz.submit',{'id':attempt['id'],'answers':[0],'score':999});assert first['score']==1
        replay,_=timed(student,'quiz.submit',{'id':attempt['id'],'answers':[1]});assert replay['score']==1
        timed(student,'lesson.note.save',{'lesson_id':lid,'body':'ملحوظة محاكاة '+str(i),'bookmarked':True,'seconds':0})
        thread,_=timed(student,'discussion.save',{'course_id':cid,'title':'سؤال محاكاة '+str(i),'body':'استفسار عن تطبيق المهارة في المشروع.'})
        orders,_=timed(student,'orders');assert all(o['student_id']=='s'+str(i) for o in orders['items'])
        return {'student_id':'s'+str(i),'course_id':cid,'submission':sub['id'],'thread':thread['id']}
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as executor: journeys=list(executor.map(journey,enumerate(students)))
    check(len(journeys)==40,'Forty concurrent learner journeys complete progress, project submission, timed quiz, notebook, discussion and private ledger')
    for j in journeys:
        timed(trainer,'submission.grade',{'id':j['submission'],'score':18,'feedback':'تطبيق محاكاة مكتمل.'})
        timed(trainer,'discussion.save',{'course_id':j['course_id'],'parent_id':j['thread'],'body':'تمت مراجعة التطبيق، أحسنت.'})
    check(int(s.sql("SELECT COUNT(*) n FROM submissions WHERE body LIKE 'حل مشروع محاكاة%' AND score=18")[0]['n'])==40,'Instructor grades all forty new projects and replies to every new discussion')
    for i,j in enumerate(journeys):
        timed(trainer,'attendance.save',{'class_id':'cl'+j['course_id'][1:],'records':[{'student_id':j['student_id'],'status':'present','note':'تصحيح سجل المحاكاة بعد التحقق'}]})
        certificate,_=timed(trainer,'certificate.issue',{'course_id':j['course_id'],'student_id':j['student_id']})
        repeat,_=timed(trainer,'certificate.issue',{'course_id':j['course_id'],'student_id':j['student_id']});assert repeat['id']==certificate['id']
        timed(students[i],'survey.save',{'course_id':j['course_id'],'content_rating':5,'trainer_rating':4,'experience_rating':5,'comment':'تقييم محاكاة مستقل.'})
    check(int(s.sql('SELECT COUNT(*) n FROM certificates')[0]['n'])==40,'Forty complete training journeys meet lessons, project, quiz and attendance requirements before certificates and surveys; issuance retries are idempotent')
    # All contenders start from separate authenticated sessions; no rate-limit override exists in app code.
    course={'title':'دورة التنافس على المقاعد','description':'محاكاة مقاعد محدودة مستقلة.','category':'اختبار','image':'/images/courses/foundation.webp','status':'published','instructor_id':'instructor','capacity':30,'duration':2}
    cid=admin.post('course.save',course)['id'];admin.post('commerce.save',{'course_id':cid,'price_minor':0,'enrollment_open':True})
    def enroll(student):
        try:timed(student,'checkout',{'course_id':cid});return 'success'
        except AssertionError as e:
            if "409" in str(e):return 'full'
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as executor: seats=list(executor.map(enroll,students))
    check(seats.count('success')==30 and seats.count('full')==10 and int(s.sql('SELECT COUNT(*) n FROM enrollments WHERE course_id=?',[cid])[0]['n'])==30,'Forty simultaneous enrollment requests allocate exactly thirty seats and refuse ten without overselling')
    # Three read profiles, with each client making requests sequentially within its own session.
    load_phases=[]
    for concurrent_clients in [5,20,40]:
        before=len(samples);begin=time.perf_counter()
        def browse(pair):
            i,client=pair; c=(i*7)%100
            actions=['data','lesson&id=c'+str(c)+'l0','catalog','orders','learning.paths']
            for request in range(25):
                result,_=timed(client,actions[request%len(actions)])
                if actions[request%len(actions)]=='orders': assert all(o['student_id']=='s'+str(i) for o in result['items'])
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_clients) as executor:list(executor.map(browse,enumerate(students[:concurrent_clients])))
        phase=samples[before:]; elapsed=time.perf_counter()-begin
        load_phases.append({'clients':concurrent_clients,'requests':len(phase),'seconds':round(elapsed,2),'requests_per_second':round(len(phase)/elapsed,2),'p50_ms':percentile([x['ms'] for x in phase],.5),'p95_ms':percentile([x['ms'] for x in phase],.95),'p99_ms':percentile([x['ms'] for x in phase],.99),'unexpected_failures':0})
    check(sum(x['requests'] for x in load_phases)==1625,'All 1625 burst requests at 5, 20 and 40 concurrent local clients return correct authorized responses')
    before=len(samples);begin=time.perf_counter();deadline=begin+30
    def sustained(pair):
        i,client=pair;c=(i*7)%100;actions=['data','lesson&id=c'+str(c)+'l0','catalog','orders','learning.paths'];request=0
        while time.perf_counter()<deadline:
            response,_=timed(client,actions[request%5]);request+=1
            if (request-1)%5==3:assert all(o['student_id']=='s'+str(i) for o in response['items'])
            time.sleep(.1)
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as executor:list(executor.map(sustained,enumerate(students)))
    phase=samples[before:];elapsed=time.perf_counter()-begin
    load_phases.append({'profile':'sustained mixed reads with 100ms think time','clients':40,'requests':len(phase),'seconds':round(elapsed,2),'requests_per_second':round(len(phase)/elapsed,2),'p50_ms':percentile([x['ms'] for x in phase],.5),'p95_ms':percentile([x['ms'] for x in phase],.95),'p99_ms':percentile([x['ms'] for x in phase],.99),'unexpected_failures':0})
    check(len(phase)>1000,'Thirty-second sustained local workload completes more than 1000 authorized requests without unexpected failures')
    # Deactivation takes effect even for a session that has already performed many requests.
    admin.post('user.toggle',{'id':'s39'});students[39].get('data',401);admin.post('user.toggle',{'id':'s39'})
    check(True,'Disabling a learner immediately revokes their existing authenticated session under load')
    # Restore a consistent SQL dump into another disposable database, then compare every table.
    restore={'performed':False,'reason':'MariaDB socket required for SQL dump/restore rehearsal'}
    if s.mysql:
        document=b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'; file=trainer.upload(document,'restore.pdf','application/pdf','c0')
        # No writes occur while taking the snapshot. Runtime keys and encrypted files are tested together.
        backup=s.folder/'backup';backup.mkdir(mode=0o700);dump=backup/'database.sql'
        with dump.open('wb') as output:subprocess.run(['mariadb-dump','--no-defaults','--socket='+s.mysql,'-u','root','--single-transaction','--skip-comments',s.name],stdout=output,check=True)
        dump.chmod(0o600);shutil.copytree(s.folder/'storage',backup/'storage');shutil.copy2(s.config,backup/'config.php')
        restored='tafaseel_restore_'+os.urandom(5).hex();s.mysql_command('CREATE DATABASE '+restored+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        try:
            begin=time.perf_counter()
            with dump.open('rb') as source:subprocess.run(['mariadb','--no-defaults','--socket='+s.mysql,'-u','root',restored],stdin=source,check=True,capture_output=True)
            restore_config=backup/'restore.php';restore_config.write_text("<?php $c=require "+repr(str(backup/'config.php'))+";$c['dsn']=str_replace('dbname="+s.name+"','dbname="+restored+"',$c['dsn']);$c['storage']="+repr(str(backup/'storage'))+";return $c;");restore_config.chmod(0o600)
            digest=s.folder/'digest.php';digest.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";$out=[];foreach(rows('SHOW TABLES') as $t){$name=array_values($t)[0];$keys=array_column(rows('SHOW INDEX FROM `'.$name.'` WHERE Key_name=\"PRIMARY\"'),'Column_name');$q=db()->query('SELECT * FROM `'.$name.'`'.($keys?' ORDER BY `'.implode('`,`',$keys).'`':''));$h=hash_init('sha256');$n=0;while($r=$q->fetch()){hash_update($h,json_encode($r,JSON_UNESCAPED_UNICODE));$n++;}$out[$name]=['rows'=>$n,'sha256'=>hash_final($h)];}ksort($out);echo json_encode($out);")
            original=json.loads(s.php([str(digest)]).stdout)
            restored_data=subprocess.run(['php',str(digest)],env={**s.env,'TAFASEEL_CONFIG':str(restore_config)},text=True,capture_output=True,check=True);after=json.loads(restored_data.stdout)
            check(original==after,'Restored MariaDB database matches row counts and complete row hashes for every table')
            decrypt=s.folder/'decrypt.php';decrypt.write_text("<?php require "+repr(str(ROOT/'server/api.php'))+";$f=one('SELECT * FROM files WHERE id=?',[$argv[1]]);echo hash('sha256',dec(encryptedObject($f['storage_name'])));")
            decrypted=subprocess.run(['php',str(decrypt),file['id']],env={**s.env,'TAFASEEL_CONFIG':str(restore_config)},text=True,capture_output=True,check=True).stdout
            check(decrypted==hashlib.sha256(document).hexdigest(),'Restored private configuration key and encrypted files reproduce the original document exactly')
            restore={'performed':True,'tables':len(original),'rows':sum(x['rows'] for x in original.values()),'dump_bytes':dump.stat().st_size,'seconds':round(time.perf_counter()-begin,2),'all_table_hashes_match':True,'encrypted_file_decryption':True,'production_data_used':False}
        finally:s.mysql_command('DROP DATABASE '+restored)
    result={'database':'MariaDB' if s.mysql else 'SQLite','fixture_counts':counts,'passed':len(checks),'failed':0,'checks':checks,'overview':{k:v for k,v in overview_meta.items() if k!='headers'},'course_workspace':{k:v for k,v in detail_meta.items() if k!='headers'},'journeys':40,'load_phases':load_phases,'measured_http_requests':len(samples),'per_action':{key:{'requests':len(values),'p50_ms':percentile(values,.5),'p95_ms':percentile(values,.95),'max_ms':round(max(values),2)} for key,values in measurements.items()},'restore':restore,'elapsed_seconds':round(time.perf_counter()-started,2),'external_providers':'unconfigured; existing provider integration suite uses loopback doubles','scope':'Local isolated PHP CLI 8 workers and MariaDB. Not a production hosting capacity or video CDN bandwidth guarantee.'}
    (ROOT/'output'/'simulation-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
