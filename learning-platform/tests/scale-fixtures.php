<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { exit(1); }
require dirname(__DIR__) . '/server/api.php';
if ((cfg()['environment'] ?? '') !== 'local' || !(cfg()['simulation'] ?? false)) {
    throw new RuntimeException('Simulation requires an isolated local configuration.');
}
function fixture(string $sql, array $args): void {
    static $statements = [];
    $statements[$sql] ??= db()->prepare($sql);
    $statements[$sql]->execute($args);
}
$n = (int) ($argv[1] ?? 5000);
$password = getenv('TAFASEEL_SIM_PASSWORD');
if (!$password || $n < 100 || $n > 20000) { throw new RuntimeException('Invalid fixture parameters'); }
$hash = password_hash($password, PASSWORD_DEFAULT);
$stamp = '2026-01-01T00:00:00Z';
tx(function () use ($n, $hash, $stamp) {
    foreach (['admin', 'instructor', 'other', 'guardian'] as $id) {
        fixture('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)', [$id, 'حساب محاكاة ' . $id, $id . '@example.test', $hash, $id === 'other' ? 'instructor' : $id, $stamp]);
    }
    for ($i = 0; $i < $n; $i++) {
        $sid = 's' . $i;
        fixture("INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,'student',?)", [$sid, 'طالب محاكاة ' . str_pad((string) $i, 5, '0', STR_PAD_LEFT), $sid . '@example.test', $hash, $stamp]);
        fixture('INSERT INTO profiles(user_id,phone,birth_date,city,guardian_id,consent_at) VALUES(?,?,?,?,?,?)', [$sid, enc('+966500000001'), '2000-01-01', 'تبوك', $i < 2 ? 'guardian' : null, $stamp]);
    }
    $questions = json_encode([['text'=>'سؤال محاكاة', 'options'=>['صحيح','آخر'], 'correct'=>0]], JSON_UNESCAPED_UNICODE);
    for ($c = 0; $c < 100; $c++) {
        $cid = 'c' . $c;
        fixture("INSERT INTO courses(id,title,description,category,image,status,instructor_id,duration,capacity,created_at) VALUES(?,?,?,?,?,'published','instructor',12,500,?)", [$cid, 'دورة محاكاة ' . $c, 'محتوى وهمي مستقل للاختبار فقط.', 'تطوير المهارات', '/images/courses/foundation.webp', $stamp]);
        fixture('INSERT INTO course_commerce(course_id,price_minor,enrollment_open,updated_at) VALUES(?,0,1,?)', [$cid,$stamp]);
        for ($l = 0; $l < 12; $l++) {
            fixture('INSERT INTO lessons(id,course_id,title,kind,body,duration,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?)', [$cid.'l'.$l,$cid,'درس محاكاة '.$l,$l % 3 === 0 ? 'video' : 'text','نص تدريبي وهمي للاختبار.',5,$l,$stamp]);
        }
        fixture('INSERT INTO quizzes(id,course_id,title,minutes,passing,max_attempts,questions,created_at) VALUES(?,?,?,10,50,2,?,?)', ['q'.$c,$cid,'اختبار محاكاة',$questions,$stamp]);
        fixture('INSERT INTO assignments(id,course_id,title,description,due_at,points,created_at) VALUES(?,?,?,?,?,20,?)', ['a'.$c,$cid,'واجب محاكاة','تطبيق عملي وهمي','2099-01-01T00:00:00Z',$stamp]);
        fixture("INSERT INTO classes(id,course_id,title,starts_at,ends_at,location,created_at) VALUES(?,?,?,'2026-01-01T10:00:00Z','2026-01-01T11:00:00Z','قاعة اختبار',?)", ['cl'.$c,$cid,'حصة محاكاة',$stamp]);
    }
    for ($i = 0; $i < $n; $i++) {
        $sid = 's'.$i;
        for ($j = 0; $j < 10; $j++) {
            $c = ($i * 7 + $j) % 100; $cid = 'c'.$c;
            fixture('INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)', [$sid.'e'.$c,$cid,$sid,$stamp]);
            for ($l = 0; $l < 6; $l++) { fixture('INSERT INTO progress(id,lesson_id,student_id,completed_at) VALUES(?,?,?,?)', [$sid.'p'.$c.'l'.$l,$cid.'l'.$l,$sid,$stamp]); }
            fixture('INSERT INTO attendance(id,class_id,student_id,status,recorded_by,updated_at) VALUES(?,?,?,?,?,?)', [$sid.'at'.$c,'cl'.$c,$sid,$i % 5 === 0 ? 'absent' : 'present','instructor',$stamp]);
            if ($j < 2) {
                fixture('INSERT INTO submissions(id,assignment_id,student_id,body,score,submitted_at) VALUES(?,?,?,?,18,?)', [$sid.'sub'.$c,'a'.$c,$sid,'إجابة وهمية',$stamp]);
                fixture('INSERT INTO attempts(id,quiz_id,student_id,started_at,expires_at,submitted_at,questions,score,total) VALUES(?,?,?,?,?,?,?,1,1)', [$sid.'try'.$c,'q'.$c,$sid,$stamp,'2026-01-01T00:10:00Z',$stamp,$questions]);
            }
        }
        fixture("INSERT INTO orders(id,student_id,course_id,amount,currency,status,expires_at,created_at,updated_at) VALUES(?,?,?,10000,'SAR',?,?,?,?)", ['o'.$i,$sid,'c'.(($i*7)%100),['paid','failed','pending','uncertain','refunded'][$i%5],'2026-01-01T00:10:00Z',$stamp,$stamp]);
    }
});
echo json_encode(['students'=>$n,'courses'=>100,'lessons'=>1200,'video_lessons'=>400,'enrollments'=>$n*10,'progress'=>$n*60,'attendance'=>$n*10,'submissions'=>$n*2,'attempts'=>$n*2,'orders'=>$n]);
