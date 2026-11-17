<?php
declare(strict_types=1);
if (PHP_SAPI !== "cli") {
    exit(1);
}
$command = $argv[1] ?? "help";
$root = dirname(__DIR__);
if ($command === "demo") {
    $dir = $root . "/.local";
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    if (!file_exists(__DIR__ . "/config.php")) {
        file_put_contents(
            __DIR__ . "/config.php",
            "<?php return " .
                var_export(
                    [
                        "environment" => "local",
                        "demo" => true,
                        "origin" => "http://127.0.0.1:3117",
                        "dsn" => "sqlite:" . $dir . "/learning.sqlite",
                        "key" => bin2hex(random_bytes(32)),
                        "storage" => $dir . "/storage",
                    ],
                    true,
                ) .
                ";",
        );
    }
    chmod(__DIR__ . "/config.php", 0600);
}
require_once __DIR__ . "/api.php";
if (in_array($command, ["demo", "migrate"], true)) {
    db()->exec(file_get_contents(__DIR__ . "/schema.sql"));
    if ($command === "migrate") {
        echo "Schema ready. No sample data or accounts were created.\n";
        exit();
    }
    if (!cfg()["demo"] || cfg()["environment"] !== "local") {
        throw new RuntimeException(
            "Sample data is limited to local development.",
        );
    }
    if (one("SELECT id FROM users LIMIT 1")) {
        echo "Local demo already initialized.\n";
        exit();
    }
    $password = bin2hex(random_bytes(12));
    $accounts = [];
    tx(function () use ($password, &$accounts) {
        $add = function ($name, $email, $role) use ($password, &$accounts) {
            $id = uid();
            run(
                "INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)",
                [
                    $id,
                    $name,
                    $email,
                    password_hash($password, PASSWORD_DEFAULT),
                    $role,
                    now(),
                ],
            );
            $accounts[$email] = [
                "id" => $id,
                "role" => $role,
                "password" => $password,
            ];
            return $id;
        };
        $admin = $add("إدارة تفاصيل", "admin@example.test", "admin");
        $t1 = $add("أحمد العتيبي", "trainer@example.test", "instructor");
        $t2 = $add("سارة الحربي", "trainer2@example.test", "instructor");
        $guardian = $add(
            "عبدالله القحطاني",
            "guardian@example.test",
            "guardian",
        );
        $names = [
            "نورة القحطاني",
            "محمد العتيبي",
            "ريم الحربي",
            "خالد الدوسري",
            "لينا الشهري",
            "عبدالعزيز الغامدي",
            "جود السبيعي",
            "سلمان المطيري",
            "شهد العنزي",
            "عمر الزهراني",
            "هيا القحطاني",
            "فيصل العمري",
        ];
        $students = [];
        foreach ($names as $i => $n) {
            $em =
                $i === 0
                    ? "student@example.test"
                    : "student" . ($i + 1) . "@example.test";
            $id = $add($n, $em, "student");
            $students[] = $id;
            run(
                "INSERT INTO profiles(user_id,phone,birth_date,city,identity_number,guardian_name,guardian_phone,guardian_id,consent_at) VALUES(?,?,?,?,?,?,?,?,?)",
                [
                    $id,
                    enc(
                        "+966500000" .
                            str_pad((string) $i, 3, "0", STR_PAD_LEFT),
                    ),
                    $i < 2 ? "2011-05-14" : "2000-03-10",
                    "تبوك",
                    "",
                    enc("ولي أمر تجريبي"),
                    enc("+966500000999"),
                    $i < 2 ? $guardian : null,
                    now(),
                ],
            );
        }
        $catalog = json_decode(
            file_get_contents(__DIR__ . "/catalog.json"),
            true,
        );
        $courseIds = [];
        $imageMap = [
            "aptitude" => "foundation",
            "english" => "step",
            "exams" => "teacher-competencies",
            "development" => "self-development",
            "arts" => "interior-design",
            "children" => "drawing-painting",
        ];
        foreach ($catalog["courses"] as $i => $c) {
            $id = uid();
            $courseIds[] = $id;
            $cat = $c["program_id"];
            $category = array_values(
                array_filter($catalog["programs"], fn($p) => $p["id"] === $cat),
            )[0]["shortTitle"];
            run(
                "INSERT INTO courses(id,title,description,category,image,status,instructor_id,duration,capacity,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                [
                    $id,
                    $c["title"],
                    $c["description"],
                    $category,
                    "/images/courses/" .
                    ($imageMap[$cat] ?? "foundation") .
                    ".webp",
                    in_array($i, [0, 2, 5, 12], true) ? "published" : "draft",
                    $i % 2 ? $t2 : $t1,
                    12 + $i,
                    20,
                    gmdate("Y-m-d\TH:i:s\Z", time() - $i * 60),
                ],
            );
        }
        $published = rows(
            "SELECT id FROM courses WHERE status='published' ORDER BY created_at DESC",
        );
        foreach ($published as $ci => $c) {
            $course = $c["id"];
            foreach ($students as $i => $s) {
                if ($ci === 3 && $i > 7) {
                    continue;
                }
                run(
                    "INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)",
                    [uid(), $course, $s, now()],
                );
            }
            foreach (
                [
                    "مرحبًا بك وخطة التعلم",
                    "المفاهيم الأساسية وتطبيقاتها",
                    "التدريب العملي والمراجعة",
                ]
                as $i => $title
            ) {
                $lid = uid();
                run(
                    "INSERT INTO lessons(id,course_id,title,kind,body,duration,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    [
                        $lid,
                        $course,
                        $title,
                        "text",
                        "هذه مادة توضيحية لتجربة المنصة.\n\nفي هذا الدرس نتعرّف على أهداف الدورة، ونستعرض الخطوات العملية للتعلم. دوّن ملاحظاتك أثناء القراءة، ثم انتقل إلى النشاط التدريبي.\n\nاستبدل هذا النص بالمحتوى التدريبي المعتمد للمركز قبل النشر.",
                        20 + $i * 10,
                        $i,
                        now(),
                    ],
                );
                foreach ($students as $si => $s) {
                    if ($si % 3 >= $i && ($ci < 3 || $si < 8)) {
                        run(
                            "INSERT INTO progress(id,lesson_id,student_id,completed_at) VALUES(?,?,?,?)",
                            [uid(), $lid, $s, now()],
                        );
                    }
                }
            }
            $aid = uid();
            run(
                "INSERT INTO assignments(id,course_id,title,description,due_at,points,created_at) VALUES(?,?,?,?,?,?,?)",
                [
                    $aid,
                    $course,
                    "النشاط التطبيقي الأول",
                    "اكتب ملخصًا للمفاهيم الأساسية مع مثال عملي من اختيارك. هذه مهمة توضيحية قابلة للتعديل.",
                    gmdate("Y-m-d\T20:59:00\Z", time() + 86400 * 3),
                    20,
                    now(),
                ],
            );
            foreach (array_slice($students, 1, 5) as $i => $s) {
                run(
                    "INSERT INTO submissions(id,assignment_id,student_id,body,score,feedback,submitted_at) VALUES(?,?,?,?,?,?,?)",
                    [
                        uid(),
                        $aid,
                        $s,
                        "إجابة تجريبية: طبقت المفهوم على مثال عملي ودوّنت الخطوات المطلوبة.",
                        $i < 2 ? 18 : null,
                        $i < 2 ? "عمل جيد، حافظ على وضوح الأمثلة." : null,
                        now(),
                    ],
                );
            }
            $questions = [
                [
                    "text" => "ما أفضل بداية لخطة تعلم فعالة؟",
                    "options" => [
                        "تحديد هدف واضح",
                        "تجاوز الدروس الأساسية",
                        "تأجيل التطبيق",
                        "الاعتماد على الحفظ فقط",
                    ],
                    "correct" => 0,
                ],
                [
                    "text" => "أي ممارسة تساعد على تثبيت المعرفة؟",
                    "options" => [
                        "عدم المراجعة",
                        "التطبيق والمراجعة المنتظمة",
                        "تجاهل الملاحظات",
                        "السرعة فقط",
                    ],
                    "correct" => 1,
                ],
            ];
            run(
                "INSERT INTO quizzes(id,course_id,title,minutes,passing,max_attempts,questions,created_at) VALUES(?,?,?,?,?,?,?,?)",
                [
                    uid(),
                    $course,
                    "اختبار المفاهيم الأساسية",
                    20,
                    60,
                    2,
                    json_encode($questions, JSON_UNESCAPED_UNICODE),
                    now(),
                ],
            );
            foreach ([-1, 0, 2] as $offset) {
                $class = uid();
                $start = gmdate("Y-m-d\T15:00:00\Z", time() + 86400 * $offset);
                run(
                    "INSERT INTO classes(id,course_id,title,starts_at,ends_at,location,created_at) VALUES(?,?,?,?,?,?,?)",
                    [
                        $class,
                        $course,
                        $offset === 0
                            ? "لقاء اليوم: التطبيق والمناقشة"
                            : "لقاء تدريبي مباشر",
                        $start,
                        gmdate("Y-m-d\T17:00:00\Z", strtotime($start)),
                        "قاعة تفاصيل " . ($ci + 1),
                        now(),
                    ],
                );
                if ($offset < 0) {
                    foreach ($students as $i => $s) {
                        if ($ci === 3 && $i > 7) {
                            continue;
                        }
                        run(
                            "INSERT INTO attendance(id,class_id,student_id,status,recorded_by,updated_at) VALUES(?,?,?,?,?,?)",
                            [
                                uid(),
                                $class,
                                $s,
                                $i % 7 === 0
                                    ? "absent"
                                    : ($i % 5 === 0
                                        ? "late"
                                        : "present"),
                                $admin,
                                now(),
                            ],
                        );
                    };
                }
            }
        }
        run(
            "INSERT INTO announcements(id,title,body,author_id,created_at) VALUES(?,?,?,?,?)",
            [
                uid(),
                "أهلًا بك في مساحة تفاصيل التعليمية",
                "كل ما تحتاجه في رحلتك التدريبية أصبح في مكان واحد. استعرض دروسك، تابع مواعيدك، وتواصل مع فريق المركز. هذا إعلان توضيحي في النسخة المحلية.",
                $admin,
                now(),
            ],
        );
        setSetting("general", [
            "name" => "مركز تفاصيل للتدريب",
            "email" => "training@example.test",
            "phone" => "0544552366",
            "certificate_attendance" => 75,
        ]);
        audit($admin, "demo.initialized");
    });
    file_put_contents(
        $root . "/.local/accounts.json",
        json_encode($accounts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
    );
    chmod($root . "/.local/accounts.json", 0600);
    echo "Local demo ready. Fictional accounts stay in .local/accounts.json. Use the local demo buttons.\n";
    exit();
}
if ($command === "admin") {
    $em = $argv[2] ?? "";
    if (!filter_var($em, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException(
            "Usage: php console.php admin email@example.com",
        );
    }
    if (one("SELECT id FROM users WHERE role='admin' LIMIT 1")) {
        throw new RuntimeException("An administrator already exists.");
    }
    echo "Administrator name: ";
    $name = trim(fgets(STDIN));
    echo "Password (12+ characters; terminal input hidden): ";
    system("stty -echo");
    try {
        $pw = trim(fgets(STDIN));
    } finally {
        system("stty echo");
        echo "\n";
    }
    $pw = pass($pw);
    run(
        "INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)",
        [
            uid(),
            str($name, 120),
            email($em),
            password_hash($pw, PASSWORD_DEFAULT),
            "admin",
            now(),
        ],
    );
    echo "Administrator created. No password was printed or stored as plaintext.\n";
    exit();
}
if ($command === "mfa-reset") {
    $em = email($argv[2] ?? "");
    $target = one("SELECT id FROM users WHERE email=?", [$em]);
    if (!$target) {
        throw new RuntimeException("Target account not found.");
    }
    echo "Current administrator email: ";
    $actor = email(trim(fgets(STDIN)));
    $admin = one(
        "SELECT * FROM users WHERE email=? AND role='admin' AND active=1",
        [$actor],
    );
    echo "Administrator password (hidden): ";
    system("stty -echo");
    try {
        $pw = rtrim(fgets(STDIN), "\r\n");
    } finally {
        system("stty echo");
        echo "\n";
    }
    if (!$admin || !password_verify($pw, $admin["password"])) {
        throw new RuntimeException("Administrator verification failed.");
    }
    run(
        "UPDATE users SET mfa_secret=NULL,mfa_last=0,auth_version=auth_version+1 WHERE id=?",
        [$target["id"]],
    );
    audit($admin, "mfa.recovered", $target["id"]);
    echo "Two-factor setup reset; all target sessions invalidated. Re-enroll from security settings.\n";
    exit();
}
if ($command === "backup") {
    $target = $argv[2] ?? "";
    if (!$target || !is_dir($target)) {
        throw new RuntimeException(
            "Provide an existing private backup directory outside public_html.",
        );
    }
    $dir = rtrim($target, "/") . "/tafaseel-" . gmdate("Ymd-His");
    mkdir($dir, 0700, true);
    $dsn = cfg()["dsn"];
    if (str_starts_with($dsn, "sqlite:")) {
        $file = $dir . "/database.sqlite";
        db()->exec("VACUUM INTO " . db()->quote($file));
        chmod($file, 0600);
    } else {
        throw new RuntimeException(
            "Use Hostinger database backups or mysqldump for MySQL. Back up storage/files and config.php with the same snapshot.",
        );
    }
    echo "Database backup created. Back up encrypted files and the key separately as documented.\n";
    exit();
}
echo "Commands: demo (local only), migrate, admin EMAIL, backup PRIVATE_DIRECTORY\n";
