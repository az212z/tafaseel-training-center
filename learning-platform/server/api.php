<?php
declare(strict_types=1);
require_once __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/extensions.php";
require_once __DIR__ . "/website.php";
require_once __DIR__ . "/learning-tools.php";
require_once __DIR__ . "/email.php";
require_once __DIR__ . "/account-invitations.php";
require_once __DIR__ . "/learning-notifications.php";
require_once __DIR__ . "/attendance-automation.php";
require_once __DIR__ . "/sms-connection.php";
function quizFieldText(
    mixed $value,
    int $max,
    string $label,
    int $min = 2,
): string {
    if (!is_string($value)) {
        fail(422, "$label يجب أن يكون نصًا.");
    }
    $value = trim($value);
    $length = mb_strlen($value);
    if ($length === 0) {
        fail(422, "$label مطلوب.");
    }
    if ($length < $min) {
        fail(422, "$label يجب أن يتكون من حرفين على الأقل.");
    }
    if ($length > $max) {
        fail(422, "$label يتجاوز الحد الأقصى المسموح ($max حرفًا).");
    }
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', $value)) {
        fail(422, "$label يحتوي على محارف غير مسموحة.");
    }
    return $value;
}
function visibleCourses(array $u): array
{
    $sql =
        "SELECT c.*,u.name AS instructor_name,(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS students_count,(SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS lessons_count FROM courses c LEFT JOIN users u ON u.id=c.instructor_id";
    $args = [];
    if ($u["role"] === "instructor") {
        $sql .= " WHERE c.instructor_id=?";
        $args = [$u["id"]];
    }
    if ($u["role"] === "student") {
        $sql .=
            " WHERE c.status='published' AND c.id IN (SELECT course_id FROM enrollments WHERE student_id=?)";
        $args = [$u["id"]];
    }
    if ($u["role"] === "guardian") {
        $sql .=
            " WHERE c.status='published' AND c.id IN (SELECT e.course_id FROM enrollments e JOIN profiles p ON e.student_id=p.user_id WHERE p.guardian_id=?)";
        $args = [$u["id"]];
    }
    return rows($sql . " ORDER BY c.created_at DESC,c.title", $args);
}
function visibleStudents(
    array $u,
    string $courseId = "",
    string $studentId = "",
): array {
    $sql =
        "SELECT u.id,u.name,u.email,u.active,u.created_at,p.birth_date,p.city FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='student'";
    $args = [];
    if ($u["role"] === "instructor") {
        $sql .=
            " AND u.id IN (SELECT e.student_id FROM enrollments e JOIN courses c ON e.course_id=c.id WHERE c.instructor_id=?)";
        $args = [$u["id"]];
    }
    if ($u["role"] === "guardian") {
        $sql .= " AND p.guardian_id=?";
        $args = [$u["id"]];
    }
    if ($u["role"] === "student") {
        $sql .= " AND u.id=?";
        $args = [$u["id"]];
    }
    if ($courseId) {
        $sql .=
            " AND u.id IN (SELECT student_id FROM enrollments WHERE course_id=?)";
        $args[] = $courseId;
    }
    if ($studentId) {
        $sql .= " AND u.id=?";
        $args[] = $studentId;
    }
    $out = rows($sql . " ORDER BY u.name,u.id", $args);
    if ($u["role"] === "instructor") {
        foreach ($out as &$student) {
            unset($student["birth_date"]);
        }
    }
    return $out;
}
function dataFor(array $u, array $scope = []): array
{
    if (staffNeedsMfa($u)) {
        return array_fill_keys(
            [
                "courses",
                "students",
                "instructors",
                "lessons",
                "enrollments",
                "assignments",
                "quizzes",
                "classes",
                "announcements",
                "support",
                "submissions",
                "attempts",
                "progress",
                "attendance",
                "certificates",
                "files",
            ],
            [],
        ) + [
            "user" => $u,
            "demo" => false,
            "mfa" => false,
            "mfa_setup_required" => true,
            "settings" => [
                "name" => "مركز تفاصيل للتدريب",
                "email" => "",
                "phone" => "",
                "certificate_attendance" => 75,
            ],
        ];
    }
    $courses = visibleCourses($u);
    $ids = array_column($courses, "id");
    $holders = $ids ? implode(",", array_fill(0, count($ids), "?")) : "''";
    $staff = in_array($u["role"], ["admin", "instructor"], true);
    $courseId = $staff ? str($scope["course_id"] ?? "", 40, false) : "";
    $studentId = $staff ? str($scope["student_id"] ?? "", 40, false) : "";
    if ($courseId) {
        courseAccess($u, $courseId, true);
    }
    if ($studentId) {
        studentAccess($u, $studentId);
    }
    $enrollmentCount = (int) one(
        "SELECT COUNT(*) n FROM enrollments WHERE course_id IN ($holders)",
        $ids,
    )["n"];
    $large =
        $staff &&
        ($enrollmentCount > 1000 ||
            ($u["role"] === "admin" &&
                (int) one("SELECT COUNT(*) n FROM users WHERE role='student'")[
                    "n"
                ] > 1000));
    $overview = $large && !$courseId && !$studentId;
    $statistics = [];
    if ($staff) {
        $statistics = [
            "students" =>
                $u["role"] === "admin"
                    ? (int) one(
                        "SELECT COUNT(*) n FROM users WHERE role='student'",
                    )["n"]
                    : (int) one(
                        "SELECT COUNT(DISTINCT student_id) n FROM enrollments WHERE course_id IN ($holders)",
                        $ids,
                    )["n"],
            "enrollments" => $enrollmentCount,
            "progress" => (int) one(
                "SELECT COUNT(*) n FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.course_id IN ($holders)",
                $ids,
            )["n"],
            "certificates" => (int) one(
                "SELECT COUNT(*) n FROM certificates WHERE course_id IN ($holders)",
                $ids,
            )["n"],
            "graded" => (int) one(
                "SELECT COUNT(*) n FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.course_id IN ($holders) AND s.score IS NOT NULL",
                $ids,
            )["n"],
            "pending" => (int) one(
                "SELECT COUNT(*) n FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.course_id IN ($holders) AND s.score IS NULL",
                $ids,
            )["n"],
        ];
        $attendanceCounts = rows(
            "SELECT a.status,COUNT(*) n FROM attendance a JOIN classes cl ON cl.id=a.class_id WHERE cl.course_id IN ($holders) GROUP BY a.status",
            $ids,
        );
        $attendanceMap = array_column($attendanceCounts, "n", "status");
        $present =
            (int) ($attendanceMap["present"] ?? 0) +
            (int) ($attendanceMap["late"] ?? 0);
        $eligible = $present + (int) ($attendanceMap["absent"] ?? 0);
        $statistics["attendance_percent"] = $eligible
            ? (int) round((100 * $present) / $eligible)
            : 0;
        $day = (new DateTimeImmutable(
            "today",
            new DateTimeZone("Asia/Riyadh"),
        ))->setTimezone(new DateTimeZone("UTC"));
        $statistics["classes_today"] = (int) one(
            "SELECT COUNT(*) n FROM classes WHERE course_id IN ($holders) AND starts_at>=? AND starts_at<?",
            [
                ...$ids,
                $day->format("Y-m-d\\TH:i:s\\Z"),
                $day->modify("+1 day")->format("Y-m-d\\TH:i:s\\Z"),
            ],
        )["n"];
        $overviewClasses = $overview
            ? rows(
                "SELECT * FROM classes WHERE course_id IN ($holders) AND ends_at>=? ORDER BY starts_at LIMIT 30",
                [...$ids, now()],
            )
            : [];
        $counts = rows(
            "SELECT l.course_id,COUNT(*) n FROM progress p JOIN lessons l ON l.id=p.lesson_id JOIN enrollments e ON e.course_id=l.course_id AND e.student_id=p.student_id WHERE l.course_id IN ($holders) GROUP BY l.course_id",
            $ids,
        );
        $map = array_column($counts, "n", "course_id");
        foreach ($courses as &$course) {
            $denominator =
                (int) $course["students_count"] *
                (int) $course["lessons_count"];
            $course["progress_percent"] = $denominator
                ? (int) round(
                    (100 * (int) ($map[$course["id"]] ?? 0)) / $denominator,
                )
                : 0;
        }
        unset($course);
    }
    $ids = $overview ? [] : ($courseId ? [$courseId] : $ids);
    $holders = $ids ? implode(",", array_fill(0, count($ids), "?")) : "''";
    $students = $overview ? [] : visibleStudents($u, $courseId, $studentId);
    $sids = array_column($students, "id");
    $sh = $sids ? implode(",", array_fill(0, count($sids), "?")) : "''";
    $staff = in_array($u["role"], ["admin", "instructor"], true);
    $lessons = rows(
        "SELECT id,course_id,title,kind,video_url,file_id,'' AS body,duration,sort_order,created_at FROM lessons WHERE course_id IN ($holders) ORDER BY sort_order,created_at",
        $ids,
    );
    $quizzes = rows(
        "SELECT id,course_id,title,minutes,passing,max_attempts,created_at FROM quizzes WHERE course_id IN ($holders) ORDER BY created_at DESC",
        $ids,
    );
    $out = [
        "user" => $u,
        "statistics" => $statistics,
        "dataset" => [
            "scoped" => $large,
            "overview" => $overview,
            "course_id" => $courseId,
            "student_id" => $studentId,
        ],
        "demo" => (bool) cfg()["demo"],
        "courses" => $courses,
        "students" => $students,
        "instructors" => rows(
            "SELECT id,name FROM users WHERE role='instructor' AND active=1 ORDER BY name",
        ),
        "lessons" => $lessons,
        "enrollments" => rows(
            "SELECT * FROM enrollments WHERE course_id IN ($holders) AND student_id IN ($sh)",
            [...$ids, ...$sids],
        ),
        "assignments" => rows(
            "SELECT * FROM assignments WHERE course_id IN ($holders) ORDER BY due_at",
            $ids,
        ),
        "quizzes" => $quizzes,
        "classes" => rows(
            "SELECT * FROM classes WHERE course_id IN ($holders) ORDER BY starts_at",
            $ids,
        ),
        "announcements" => rows(
            "SELECT a.*,u.name AS author_name FROM announcements a JOIN users u ON a.author_id=u.id WHERE a.course_id IS NULL OR a.course_id IN ($holders) ORDER BY a.created_at DESC LIMIT 100",
            $ids,
        ),
        "settings" => setting("general", [
            "name" => "مركز تفاصيل للتدريب",
            "email" => "",
            "phone" => "0544552366",
            "certificate_attendance" => 75,
        ]),
        "support" => rows(
            $u["role"] === "admin"
                ? "SELECT s.*,u.name FROM support s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 100"
                : "SELECT s.*,u.name FROM support s JOIN users u ON u.id=s.user_id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 100",
            $u["role"] === "admin" ? [] : [$u["id"]],
        ),
    ];
    $out["submissions"] = rows(
        "SELECT s.* FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.course_id IN ($holders) AND s.student_id IN ($sh)",
        [...$ids, ...$sids],
    );
    $out["attempts"] = rows(
        "SELECT a.id,a.quiz_id,a.student_id,a.started_at,a.expires_at,a.submitted_at,a.score,a.total FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE q.course_id IN ($holders) AND a.student_id IN ($sh)",
        [...$ids, ...$sids],
    );
    $out["progress"] = rows(
        "SELECT p.* FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.course_id IN ($holders) AND p.student_id IN ($sh)",
        [...$ids, ...$sids],
    );
    $out["attendance"] = rows(
        "SELECT a.* FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.course_id IN ($holders) AND a.student_id IN ($sh)",
        [...$ids, ...$sids],
    );
    $out["certificates"] = rows(
        "SELECT f.*,u.name AS student_name,c.title AS course_title,c.duration FROM certificates f JOIN users u ON u.id=f.student_id JOIN courses c ON c.id=f.course_id WHERE f.course_id IN ($holders) AND f.student_id IN ($sh)",
        [...$ids, ...$sids],
    );
    $fileWhere = "1=1";
    $fileArgs = [];
    if ($u["role"] === "instructor") {
        $fileWhere =
            "f.owner_id=? OR (f.purpose<>'identity' AND f.course_id IN (SELECT id FROM courses WHERE instructor_id=?))";
        $fileArgs = [$u["id"], $u["id"]];
    } elseif ($u["role"] === "student") {
        $fileWhere =
            "f.owner_id=? OR (f.purpose IN ('identity','submission') AND f.student_id=?) OR (f.purpose='resource' AND f.course_id IN (SELECT e.course_id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND c.status='published'))";
        $fileArgs = [$u["id"], $u["id"], $u["id"]];
    } elseif ($u["role"] === "guardian") {
        $fileWhere =
            "f.owner_id=? OR (f.purpose IN ('identity','submission') AND f.student_id IN (SELECT user_id FROM profiles WHERE guardian_id=?)) OR (f.purpose='resource' AND f.course_id IN (SELECT e.course_id FROM enrollments e JOIN profiles p ON p.user_id=e.student_id JOIN courses c ON c.id=e.course_id WHERE p.guardian_id=? AND c.status='published'))";
        $fileArgs = [$u["id"], $u["id"], $u["id"]];
    }
    $out["files"] = rows(
        "SELECT f.id,f.owner_id,f.course_id,f.student_id,f.purpose,f.name,f.mime,f.bytes,f.created_at FROM files f WHERE ($fileWhere) ORDER BY f.created_at DESC LIMIT 1000",
        $fileArgs,
    );
    if ($u["role"] === "admin") {
        $out["users"] = rows(
            "SELECT id,name,email,role,active,created_at FROM users WHERE role<>'student' ORDER BY created_at DESC",
        );
        $out["audit"] = rows(
            "SELECT a.*,u.name AS actor_name FROM audit a LEFT JOIN users u ON a.actor_id=u.id ORDER BY a.created_at DESC LIMIT 200",
        );
    }
    if ($overview) {
        $out["classes"] = $overviewClasses;
    }
    $zoomRows = rows(
        "SELECT z.class_id,z.status,z.meeting_id FROM zoom_meetings z JOIN classes c ON c.id=z.class_id WHERE c.course_id IN ($holders)",
        $ids,
    );
    foreach ($out["classes"] as &$class) {
        $z = array_values(
            array_filter($zoomRows, fn($z) => $z["class_id"] === $class["id"]),
        );
        $class["zoom_status"] = $z[0]["status"] ?? null;
    }
    unset($class);
    automationClassDetails($out["classes"], $staff);
    $videoMap = rows(
        "SELECT id,lesson_id,status FROM video_assets WHERE lesson_id IS NOT NULL AND course_id IN ($holders)",
        $ids,
    );
    foreach ($out["lessons"] as &$lesson) {
        foreach ($videoMap as $v) {
            if ($v["lesson_id"] === $lesson["id"]) {
                $lesson["video_asset_id"] = $v["id"];
                $lesson["video_status"] = $v["status"];
            }
        }
    }
    unset($lesson);
    $out["commerce"] =
        $u["role"] === "admin" ? rows("SELECT * FROM course_commerce") : [];
    $out["capabilities"] = [
        "video" => integrationEnabled("video"),
        "zoom" => integrationEnabled("zoom"),
        "payments" => integrationEnabled("moyasar"),
    ];
    $out["mfa_available"] = (bool) (cfg()["staff_mfa_enabled"] ?? true);
    $out["mfa"] =
        (cfg()["staff_mfa_enabled"] ?? true) &&
        (bool) (one("SELECT mfa_secret FROM users WHERE id=?", [$u["id"]])[
            "mfa_secret"
        ] ?? false);
    return $out;
}
function checkFileRef(
    array $u,
    ?string $id,
    string $purpose,
    ?string $course,
    ?string $student = null,
): void {
    if (!$id) {
        return;
    }
    $f = one("SELECT * FROM files WHERE id=?", [$id]);
    if (
        !$f ||
        $f["purpose"] !== $purpose ||
        $f["course_id"] !== $course ||
        ($student !== null && $f["student_id"] !== $student) ||
        ($u["role"] !== "admin" && $f["owner_id"] !== $u["id"])
    ) {
        fail(422, "المرفق غير صالح لهذا المحتوى.");
    }
}
function api(string $action, string $method, array $d, string $raw = ""): array
{
    $invitation = accountInvitationAction($action, $method, $d);
    if ($invitation !== null) {
        return $invitation;
    }
    $email = emailAction($action, $method, $d);
    if ($email !== null) {
        return $email;
    }
    $learning = learningToolsAction($action, $method, $d);
    if ($learning !== null) {
        return $learning;
    }
    $website = websiteAction($action, $method, $d);
    if ($website !== null) {
        return $website;
    }
    $extension = extensionAction($action, $method, $d, $raw);
    if ($extension !== null) {
        return $extension;
    }
    $gets = [
        "session",
        "data",
        "student",
        "quiz",
        "quiz.attempt",
        "file",
        "health",
        "learning.updates",
        "sms.connection",
    ];
    if ($method !== (in_array($action, $gets, true) ? "GET" : "POST")) {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    if ($action === "health") {
        cfg();
        db();
        return ["ok" => true, "version" => "2.0.0"];
    }
    if ($action === "session") {
        sessionStart();
        return [
            "user" => currentUser(),
            "csrf" => $_SESSION["csrf"],
            "demo" => (bool) cfg()["demo"],
            "registration_enabled" =>
                (bool) (cfg()["registration_enabled"] ?? true),
        ];
    }
    if ($method === "POST") {
        csrf();
    }
    if ($action === "login") {
        rate("login-ip:" . ($_SERVER["REMOTE_ADDR"] ?? ""), 300, 900);
        $em = strtolower(str($d["email"] ?? "", 190));
        rate("login-email:" . $em, 12, 900);
        $pw = str($d["password"] ?? "", 128);
        if (filter_var($em, FILTER_VALIDATE_EMAIL)) {
            $u = one("SELECT * FROM users WHERE email=? AND active=1", [$em]);
        } else {
            $adminLogin = setting("admin_login", []);
            $u =
                preg_match('/^[a-z0-9][a-z0-9_.-]{2,31}$/', $em) &&
                hash_equals(strtolower($adminLogin["username"] ?? ""), $em)
                    ? one(
                        "SELECT * FROM users WHERE id=? AND role='admin' AND active=1",
                        [$adminLogin["user_id"] ?? ""],
                    )
                    : null;
        }
        $valid = password_verify(
            $pw,
            $u["password"] ??
                '$2y$12$YJaOwODctYwAC86vwF8BjOlp6PrHx.WgIWIVvq2vnthNOIr3CeeYe',
        );
        if (!$u || !$valid) {
            audit(null, "session.denied");
            fail(401, "اسم المستخدم أو البريد أو كلمة المرور غير صحيحة.");
        }
        if ((cfg()["staff_mfa_enabled"] ?? true) && $u["mfa_secret"]) {
            $_SESSION["mfa_challenge"] = [
                "id" => $u["id"],
                "expires" => time() + 300,
            ];
            return ["mfaRequired" => true];
        }
        return loginUser($u);
    }
    if ($action === "login.mfa") {
        if (!(cfg()["staff_mfa_enabled"] ?? true)) {
            fail(403, "المصادقة الإضافية غير مفعلة.");
        }
        rate("mfa:" . session_id(), 8, 300);
        $challenge = $_SESSION["mfa_challenge"] ?? null;
        if (!$challenge || $challenge["expires"] < time()) {
            fail(401, "انتهت مهلة التحقق. سجّل الدخول مجددًا.");
        }
        $u = one("SELECT * FROM users WHERE id=? AND active=1", [
            $challenge["id"],
        ]);
        $step = $u
            ? totpStep(
                dec($u["mfa_secret"]),
                digits(str($d["code"] ?? "", 6)),
                (int) $u["mfa_last"],
            )
            : 0;
        if (!$step) {
            fail(401, "رمز التحقق غير صحيح أو استُخدم مسبقًا.");
        }
        run("UPDATE users SET mfa_last=? WHERE id=?", [$step, $u["id"]]);
        return loginUser($u);
    }
    if ($action === "demo") {
        if (
            !cfg()["demo"] ||
            cfg()["environment"] === "production" ||
            !in_array($_SERVER["REMOTE_ADDR"] ?? "", ["127.0.0.1", "::1"], true)
        ) {
            fail(404, "المسار غير موجود.");
        }
        $role = $d["role"] ?? "admin";
        if (
            !in_array(
                $role,
                ["admin", "instructor", "student", "guardian"],
                true,
            )
        ) {
            fail(422, "الحساب غير متاح.");
        }
        $u = one(
            "SELECT * FROM users WHERE role=? AND active=1 ORDER BY created_at,id LIMIT 1",
            [$role],
        );
        if (!$u) {
            fail(404, "حساب التجربة غير متاح.");
        }
        return loginUser($u);
    }
    $u = auth([], $action !== "learning.updates");
    staffMfaGuard($u, $action);
    if ($action === "logout") {
        audit($u, "session.logout");
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION["csrf"] = bin2hex(random_bytes(32));
        return ["ok" => true, "csrf" => $_SESSION["csrf"]];
    }
    if ($action === "data") {
        return dataFor($u, $d);
    }
    if ($action === "learning.updates") {
        return learningUpdates($u, number($d["page"] ?? 1, 1, 1000000));
    }
    if ($action === "learning.updates.read") {
        return readLearningUpdates($u, $d);
    }
    if ($action === "class.attendance.control") {
        return attendanceAutomationControl($u, $d);
    }
    if ($action === "sms.connection") {
        return smsConnectionStatus();
    }
    if ($action === "sms.connection.save") {
        return saveSmsConnection($u, $d);
    }
    if ($action === "account.profile") {
        auth(["admin"]);
        rate("account-profile:" . $u["id"], 8, 900);
        $current = str($d["current"] ?? "", 128);
        $row = one("SELECT password FROM users WHERE id=?", [$u["id"]]);
        if (!password_verify($current, $row["password"])) {
            fail(422, "كلمة المرور الحالية غير صحيحة.");
        }
        $name = str($d["name"] ?? "", 120);
        $em = email($d["email"] ?? "");
        tx(function () use ($u, $name, $em) {
            $conflict = one("SELECT id FROM users WHERE email=?", [$em]);
            if ($conflict && $conflict["id"] !== $u["id"]) {
                fail(409, "البريد مسجل مسبقًا.");
            }
            run("UPDATE users SET name=?,email=? WHERE id=?", [
                $name,
                $em,
                $u["id"],
            ]);
            audit($u, "account.profile_updated", $u["id"]);
        });
        return ["ok" => true];
    }
    if ($action === "password") {
        $old = str($d["current"] ?? "", 128);
        $row = one("SELECT password FROM users WHERE id=?", [$u["id"]]);
        rate("password:" . $u["id"], 8, 900);
        if (!password_verify($old, $row["password"])) {
            fail(422, "كلمة المرور الحالية غير صحيحة.");
        }
        $pw = pass($d["password"] ?? "");
        run(
            "UPDATE users SET password=?,auth_version=auth_version+1 WHERE id=?",
            [password_hash($pw, PASSWORD_DEFAULT), $u["id"]],
        );
        $_SESSION["version"]++;
        session_regenerate_id(true);
        audit($u, "password.changed");
        return ["ok" => true];
    }
    if (
        in_array($action, ["mfa.begin", "mfa.confirm"], true) &&
        !(cfg()["staff_mfa_enabled"] ?? true)
    ) {
        fail(
            403,
            "الدخول باسم المستخدم وكلمة المرور. المصادقة الإضافية غير مفعلة.",
        );
    }
    if ($action === "mfa.begin") {
        auth(["admin", "instructor"]);
        rate("mfa-enroll:" . $u["id"], 6, 900);
        $row = one("SELECT password,mfa_secret FROM users WHERE id=?", [
            $u["id"],
        ]);
        if (
            !password_verify(str($d["password"] ?? "", 128), $row["password"])
        ) {
            fail(422, "كلمة المرور غير صحيحة.");
        }
        if ($row["mfa_secret"]) {
            fail(409, "المصادقة الثنائية مفعلة.");
        }
        $secret = "";
        for ($i = 0; $i < 32; $i++) {
            $secret .= "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[random_int(0, 31)];
        }
        $_SESSION["mfa_enroll"] = [
            "secret" => $secret,
            "expires" => time() + 600,
        ];
        return ["secret" => $secret];
    }
    if ($action === "mfa.confirm") {
        auth(["admin", "instructor"]);
        rate("mfa-confirm:" . $u["id"], 8, 600);
        $p = $_SESSION["mfa_enroll"] ?? null;
        if (!$p || $p["expires"] < time()) {
            fail(422, "ابدأ تفعيل المصادقة مجددًا.");
        }
        $step = totpStep($p["secret"], digits(str($d["code"] ?? "", 6)));
        if (!$step) {
            fail(422, "رمز التحقق غير صحيح.");
        }
        run("UPDATE users SET mfa_secret=?,mfa_last=? WHERE id=?", [
            enc($p["secret"]),
            $step,
            $u["id"],
        ]);
        unset($_SESSION["mfa_enroll"]);
        audit($u, "mfa.enabled");
        return ["ok" => true];
    }
    if ($action === "student") {
        $id = str($d["id"] ?? "", 40);
        $s = studentAccess($u, $id);
        $p = one("SELECT * FROM profiles WHERE user_id=?", [$id]) ?? [];
        if ($u["role"] !== "instructor") {
            foreach (
                ["phone", "guardian_name", "guardian_phone", "identity_number"]
                as $f
            ) {
                $p[$f] = dec($p[$f] ?? "");
            }
            $legacy = one(
                "SELECT payload FROM legacy_links WHERE kind='student' AND new_id=?",
                [$id],
            );
            if ($legacy) {
                $p["legacy_contact"] =
                    json_decode(dec($legacy["payload"]), true)["contact"] ?? "";
            }
            audit($u, "student.private_view", $id);
        } else {
            $p = array_intersect_key($p, array_flip(["city"]));
        }
        return ["student" => $s, "profile" => $p];
    }
    if ($action === "user.save") {
        auth(["admin"]);
        $id = $d["id"] ?? "";
        $name = str($d["name"] ?? "", 120);
        $em = email($d["email"] ?? "");
        $role = $d["role"] ?? "student";
        if (!in_array($role, ["student", "instructor", "guardian"], true)) {
            fail(422, "نوع الحساب غير صحيح.");
        }
        $existing = $id ? one("SELECT * FROM users WHERE id=?", [$id]) : null;
        if ($id && !$existing) {
            fail(404, "الحساب غير موجود.");
        }
        if ($existing && $existing["role"] !== $role) {
            fail(422, "لا يمكن تغيير نوع حساب موجود.");
        }
        $conflict = one("SELECT id FROM users WHERE email=?", [$em]);
        if ($conflict && $conflict["id"] !== $id) {
            fail(409, "البريد مسجل مسبقًا.");
        }
        $invite = !$existing && ($d["send_invite"] ?? false) === true;
        $pw = $invite
            ? bin2hex(random_bytes(32))
            : (!$existing || !empty($d["password"])
                ? pass($d["password"] ?? "")
                : null);
        $profile = [];
        if ($role === "student") {
            $birth = str($d["birth_date"] ?? "", 12);
            $dt = DateTimeImmutable::createFromFormat("!Y-m-d", $birth);
            if (
                !$dt ||
                $dt->format("Y-m-d") !== $birth ||
                $dt > new DateTimeImmutable() ||
                $dt < new DateTimeImmutable("-100 years")
            ) {
                fail(422, "تاريخ الميلاد غير صحيح.");
            }
            $minor = $dt->diff(new DateTimeImmutable())->y < 18;
            $gn = str($d["guardian_name"] ?? "", 120, $minor);
            $gp = phone($d["guardian_phone"] ?? "", $minor);
            $gi = $d["guardian_id"] ?? null;
            if (
                $gi &&
                !one(
                    "SELECT id FROM users WHERE id=? AND role='guardian' AND active=1",
                    [$gi],
                )
            ) {
                fail(422, "حساب ولي الأمر غير صحيح.");
            }
            $identity = digits(str($d["identity_number"] ?? "", 15, false));
            if ($identity && !preg_match('/^[12]\d{9}$/', $identity)) {
                fail(
                    422,
                    "رقم الهوية أو الإقامة يجب أن يكون ١٠ أرقام ويبدأ بـ١ أو ٢.",
                );
            }
            if (($d["consent"] ?? false) !== true) {
                fail(422, "وثّق الموافقة على حفظ بيانات الطالب.");
            }
            $profile = [
                enc(phone($d["phone"] ?? "", $minor ? false : true)),
                $birth,
                str($d["city"] ?? "", 100, false),
                enc($identity),
                enc($gn),
                enc($gp),
                $gi ?: null,
            ];
        }
        $id = $id ?: uid();
        tx(function () use (
            $id,
            $existing,
            $name,
            $em,
            $role,
            $pw,
            $profile,
            $u,
            $invite,
        ) {
            if ($existing) {
                run("UPDATE users SET name=?,email=? WHERE id=?", [
                    $name,
                    $em,
                    $id,
                ]);
                if ($pw) {
                    run(
                        "UPDATE users SET password=?,auth_version=auth_version+1 WHERE id=?",
                        [password_hash($pw, PASSWORD_DEFAULT), $id],
                    );
                }
            } else {
                run(
                    "INSERT INTO users(id,name,email,password,role,active,created_at) VALUES(?,?,?,?,?,?,?)",
                    [
                        $id,
                        $name,
                        $em,
                        password_hash($pw, PASSWORD_DEFAULT),
                        $role,
                        $invite ? 0 : 1,
                        now(),
                    ],
                );
            }
            if ($role === "student") {
                $previous = one(
                    "SELECT guardian_phone,guardian_id FROM profiles WHERE user_id=?",
                    [$id],
                );
                if (
                    $previous &&
                    (dec($previous["guardian_phone"]) !== dec($profile[5]) ||
                        ($previous["guardian_id"] ?? null) !== $profile[6])
                ) {
                    run(
                        "UPDATE guardian_preferences SET sms_enabled=0,consent_at=NULL,updated_by=?,updated_at=? WHERE student_id=?",
                        [$u["id"], now(), $id],
                    );
                    run(
                        "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE student_id=? AND status IN ('pending','retry','blocked')",
                        [now(), $id],
                    );
                    audit($u, "guardian.sms_consent_reset", $id);
                }
                if (
                    one("SELECT user_id FROM profiles WHERE user_id=?", [$id])
                ) {
                    run(
                        "UPDATE profiles SET phone=?,birth_date=?,city=?,identity_number=?,guardian_name=?,guardian_phone=?,guardian_id=?,consent_at=? WHERE user_id=?",
                        [...$profile, now(), $id],
                    );
                } else {
                    run(
                        "INSERT INTO profiles(phone,birth_date,city,identity_number,guardian_name,guardian_phone,guardian_id,consent_at,user_id) VALUES(?,?,?,?,?,?,?,?,?)",
                        [...$profile, now(), $id],
                    );
                }
            }
            audit($u, $existing ? "user.updated" : "user.created", $id);
            if ($invite) {
                issueAccountInvitation($id, $u);
            }
        });
        return ["id" => $id, "invitation_queued" => $invite];
    }
    if ($action === "user.toggle") {
        auth(["admin"]);
        $id = str($d["id"] ?? "", 40);
        $target = one("SELECT * FROM users WHERE id=?", [$id]);
        if (!$target || $target["role"] === "admin") {
            fail(422, "لا يمكن تغيير حالة هذا الحساب.");
        }
        if (
            !$target["active"] &&
            one(
                "SELECT id FROM account_invitations WHERE user_id=? AND used_at IS NULL",
                [$id],
            )
        ) {
            fail(
                409,
                "الحساب ينتظر توثيق البريد من صاحبه. أعد إرسال دعوة التسجيل عند الحاجة.",
            );
        }
        if (!$target["active"] && $target["role"] === "student") {
            $p = one(
                "SELECT birth_date,consent_at,guardian_name,guardian_phone FROM profiles WHERE user_id=?",
                [$id],
            );
            if (!$p || !$p["birth_date"] || !$p["consent_at"]) {
                fail(
                    422,
                    "راجع تاريخ الميلاد والموافقة وبيانات ولي الأمر في ملف الطالب قبل التفعيل.",
                );
            }
            $age = (new DateTimeImmutable($p["birth_date"]))->diff(
                new DateTimeImmutable(),
            )->y;
            if (
                $age < 18 &&
                (!dec($p["guardian_name"]) || !dec($p["guardian_phone"]))
            ) {
                fail(422, "أكمل بيانات ولي الأمر قبل تفعيل حساب القاصر.");
            }
        }
        run(
            "UPDATE users SET active=?,auth_version=auth_version+1 WHERE id=?",
            [$target["active"] ? 0 : 1, $id],
        );
        if (!$target["active"]) {
            queueEmail(
                "activated:" . $id . ":" . now(),
                $id,
                "account",
                "حسابك في تفاصيل جاهز",
                "اعتمدت إدارة المركز طلبك. يمكنك الآن تسجيل الدخول باستخدام بريدك وكلمة المرور التي اخترتها.",
                "/login",
            );
        }
        audit($u, "user.status_changed", $id);
        return ["ok" => true];
    }
    if ($action === "course.save") {
        auth(["admin", "instructor"]);
        $id = $d["id"] ?? "";
        if ($id) {
            courseAccess($u, $id, true);
        } elseif ($u["role"] !== "admin") {
            fail(403, "إضافة الدورات من صلاحية الإدارة.");
        }
        $status = $d["status"] ?? "draft";
        if (!in_array($status, ["draft", "published", "archived"], true)) {
            fail(422, "حالة الدورة غير صحيحة.");
        }
        $teacher = $d["instructor_id"] ?? null;
        if (
            $teacher &&
            !one(
                "SELECT id FROM users WHERE id=? AND role='instructor' AND active=1",
                [$teacher],
            )
        ) {
            fail(422, "المدرب غير متاح.");
        }
        if ($u["role"] === "instructor" && $teacher !== $u["id"]) {
            fail(403, "لا يمكنك تغيير مدرب الدورة.");
        }
        $image = $d["image"] ?? "/images/courses/foundation.webp";
        if (!preg_match('#^/images/courses/[a-z-]+\.webp$#', $image)) {
            fail(422, "اختر غلافًا من المكتبة.");
        }
        $values = [
            str($d["title"] ?? "", 200),
            str($d["description"] ?? "", 5000),
            str($d["category"] ?? "", 100),
            $image,
            $status,
            $teacher ?: null,
            number($d["duration"] ?? 0, 0, 2000),
            number($d["capacity"] ?? 20, 1, 500),
        ];
        $new = !$id;
        $wasPublished =
            $id &&
            (one("SELECT status FROM courses WHERE id=?", [$id])["status"] ??
                "") ===
                "published";
        $id = $id ?: uid();
        tx(function () use ($new, $id, $values, $u, $wasPublished) {
            if ($new) {
                run(
                    "INSERT INTO courses(title,description,category,image,status,instructor_id,duration,capacity,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                    [...$values, $id, now()],
                );
            } else {
                lockRow("courses", $id);
                $count = (int) one(
                    "SELECT COUNT(*) n FROM enrollments WHERE course_id=?",
                    [$id],
                )["n"];
                if ($values[7] < $count + reservedSeats($id)) {
                    fail(422, "السعة أقل من عدد الطلاب المسجلين.");
                }
                run(
                    "UPDATE courses SET title=?,description=?,category=?,image=?,status=?,instructor_id=?,duration=?,capacity=? WHERE id=?",
                    [...$values, $id],
                );
            }
            audit($u, $new ? "course.created" : "course.updated", $id);
            if (!$wasPublished && $values[4] === "published") {
                courseUpdate(
                    $id,
                    "course",
                    $id,
                    "أصبح محتوى الدورة متاحًا",
                    "/courses/" . $id,
                );
            }
        });
        return ["id" => $id];
    }
    if ($action === "enroll") {
        auth(["admin"]);
        $course = str($d["course_id"] ?? "", 40);
        $student = str($d["student_id"] ?? "", 40);
        courseAccess($u, $course, true);
        studentAccess($u, $student);
        tx(function () use ($course, $student, $u) {
            lockRow("courses", $course);
            if (
                one(
                    "SELECT id FROM enrollments WHERE course_id=? AND student_id=?",
                    [$course, $student],
                )
            ) {
                fail(409, "الطالب مسجل في هذه الدورة.");
            }
            $c = one("SELECT capacity FROM courses WHERE id=?", [$course]);
            if (
                (int) one(
                    "SELECT COUNT(*) n FROM enrollments WHERE course_id=?",
                    [$course],
                )["n"] +
                    reservedSeats($course) >=
                (int) $c["capacity"]
            ) {
                fail(409, "اكتمل عدد المقاعد في الدورة.");
            }
            run(
                "INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)",
                [uid(), $course, $student, now()],
            );
            audit($u, "student.enrolled", $course);
            emailEnrollment($course, $student);
        });
        return ["ok" => true];
    }
    if ($action === "lesson.save") {
        $course = str($d["course_id"] ?? "", 40);
        courseAccess($u, $course, true);
        $id = $d["id"] ?? "";
        if (
            $id &&
            !one("SELECT id FROM lessons WHERE id=? AND course_id=?", [
                $id,
                $course,
            ])
        ) {
            fail(404, "الدرس غير موجود.");
        }
        $kind = $d["kind"] ?? "text";
        if (!in_array($kind, ["text", "video", "file"], true)) {
            fail(422, "نوع الدرس غير صحيح.");
        }
        $url = urlInput($d["video_url"] ?? "", [
            "youtube.com",
            "www.youtube.com",
            "youtu.be",
            "vimeo.com",
            "www.vimeo.com",
        ]);
        $file = $d["file_id"] ?? null;
        if ($file) {
            checkFileRef($u, $file, "resource", $course);
        }
        if (
            $kind === "video" &&
            $file &&
            one("SELECT mime FROM files WHERE id=?", [$file])["mime"] !==
                "video/mp4"
        ) {
            fail(422, "ملف الفيديو يجب أن يكون بصيغة MP4.");
        }
        if ($kind === "video" && !$url && !$file) {
            fail(422, "أضف رابط الفيديو أو ارفع ملفه.");
        }
        if ($kind === "file" && !$file) {
            fail(422, "ارفع ملف الدرس أولًا.");
        }
        $body = str($d["body"] ?? "", 20000, $kind === "text");
        $values = [
            str($d["title"] ?? "", 200),
            $kind,
            $url,
            $file ?: null,
            $body,
            number($d["duration"] ?? 0, 0, 10000),
            number($d["sort_order"] ?? 0, 0, 10000),
        ];
        $new = !$id;
        $id = $id ?: uid();
        return tx(function () use ($new, $id, $values, $course, $u) {
            if (!$new) {
                run(
                    "UPDATE lessons SET title=?,kind=?,video_url=?,file_id=?,body=?,duration=?,sort_order=? WHERE id=?",
                    [...$values, $id],
                );
            } else {
                run(
                    "INSERT INTO lessons(title,kind,video_url,file_id,body,duration,sort_order,id,course_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                    [...$values, $id, $course, now()],
                );
            }
            audit($u, "lesson.saved", $id);
            if ($new) {
                courseUpdate(
                    $course,
                    "lesson",
                    $id,
                    "درس جديد: " . $values[0],
                    "/courses/" . $course . "?lesson=" . $id,
                );
            }
            return ["id" => $id];
        });
    }
    if ($action === "progress") {
        auth(["student"]);
        $lesson = one("SELECT * FROM lessons WHERE id=?", [
            $d["lesson_id"] ?? "",
        ]);
        if (!$lesson) {
            fail(404, "الدرس غير موجود.");
        }
        courseAccess($u, $lesson["course_id"]);
        $insert =
            "INSERT INTO progress(id,lesson_id,student_id,completed_at) VALUES(?,?,?,?)";
        $insert .=
            db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql"
                ? " ON DUPLICATE KEY UPDATE id=id"
                : " ON CONFLICT(lesson_id,student_id) DO NOTHING";
        run($insert, [uid(), $lesson["id"], $u["id"], now()]);
        return ["ok" => true];
    }
    if ($action === "assignment.save") {
        $course = str($d["course_id"] ?? "", 40);
        courseAccess($u, $course, true);
        $id = uid();
        return tx(function () use ($id, $course, $d, $u) {
            run(
                "INSERT INTO assignments(id,course_id,title,description,due_at,points,created_at) VALUES(?,?,?,?,?,?,?)",
                [
                    $id,
                    $course,
                    str($d["title"] ?? "", 200),
                    str($d["description"] ?? "", 10000),
                    dateInput($d["due_at"] ?? ""),
                    number($d["points"] ?? 100, 1, 1000),
                    now(),
                ],
            );
            audit($u, "assignment.created", $id);
            courseUpdate(
                $course,
                "assignment",
                $id,
                "واجب جديد: " . str($d["title"] ?? "", 200),
                "/assignments?course=" . $course . "&assignment=" . $id,
            );
            return ["id" => $id];
        });
    }
    if ($action === "submission.save") {
        auth(["student"]);
        $a = one("SELECT * FROM assignments WHERE id=?", [
            $d["assignment_id"] ?? "",
        ]);
        if (!$a) {
            fail(404, "الواجب غير موجود.");
        }
        courseAccess($u, $a["course_id"]);
        if (strtotime($a["due_at"]) < time()) {
            fail(409, "انتهى موعد تسليم الواجب.");
        }
        $file = $d["file_id"] ?? null;
        checkFileRef($u, $file, "submission", $a["course_id"], $u["id"]);
        $body = str($d["body"] ?? "", 10000, !$file);
        return tx(function () use ($u, $a, $file, $body) {
            lockRow("courses", $a["course_id"]);
            $existing = one(
                "SELECT * FROM submissions WHERE assignment_id=? AND student_id=?",
                [$a["id"], $u["id"]],
            );
            if ($existing && $existing["score"] !== null) {
                fail(409, "تم تقييم الواجب؛ لا يمكن تعديله.");
            }
            $id = $existing["id"] ?? uid();
            if ($existing) {
                run(
                    "UPDATE submissions SET body=?,file_id=?,submitted_at=? WHERE id=?",
                    [$body, $file ?: null, now(), $id],
                );
            } else {
                run(
                    "INSERT INTO submissions(id,assignment_id,student_id,body,file_id,submitted_at) VALUES(?,?,?,?,?,?)",
                    [$id, $a["id"], $u["id"], $body, $file ?: null, now()],
                );
            }
            audit($u, "assignment.submitted", $id);
            return ["id" => $id];
        });
    }
    if ($action === "submission.grade") {
        $s = one(
            "SELECT s.*,a.course_id,a.points FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=?",
            [$d["id"] ?? ""],
        );
        if (!$s) {
            fail(404, "التسليم غير موجود.");
        }
        courseAccess($u, $s["course_id"], true);
        $score = number($d["score"] ?? "", 0, (int) $s["points"]);
        $feedback = str($d["feedback"] ?? "", 3000, false);
        return tx(function () use ($u, $s, $score, $feedback) {
            lockRow("courses", $s["course_id"]);
            run("UPDATE submissions SET score=?,feedback=? WHERE id=?", [
                $score,
                $feedback,
                $s["id"],
            ]);
            audit($u, "submission.graded", $s["id"]);
            return ["ok" => true];
        });
    }
    if ($action === "quiz.save") {
        $course = str($d["course_id"] ?? "", 40);
        courseAccess($u, $course, true);
        $title = quizFieldText($d["title"] ?? "", 200, "اسم الاختبار");
        $questions = $d["questions"] ?? [];
        if (
            !is_array($questions) ||
            count($questions) < 1 ||
            count($questions) > 50
        ) {
            fail(422, "أضف من سؤال واحد إلى ٥٠ سؤالًا.");
        }
        $clean = [];
        foreach (array_values($questions) as $index => $q) {
            $question = $index + 1;
            if (!is_array($q)) {
                fail(422, "بيانات السؤال $question غير صحيحة.");
            }
            $opts = $q["options"] ?? [];
            if (!is_array($opts) || count($opts) < 2 || count($opts) > 6) {
                fail(422, "أضف من خيارين إلى ٦ خيارات للسؤال $question.");
            }
            $options = [];
            foreach (array_values($opts) as $choice => $value) {
                $option = $choice + 1;
                $options[] = quizFieldText(
                    $value,
                    500,
                    "الخيار $option في السؤال $question",
                    1,
                );
            }
            $correct = filter_var($q["correct"] ?? null, FILTER_VALIDATE_INT);
            if (
                $correct === false ||
                $correct < 0 ||
                $correct >= count($options)
            ) {
                fail(422, "حدد الإجابة الصحيحة للسؤال $question.");
            }
            $clean[] = [
                "text" => quizFieldText(
                    $q["text"] ?? "",
                    1000,
                    "نص السؤال $question",
                ),
                "options" => $options,
                "correct" => $correct,
            ];
        }
        $id = uid();
        return tx(function () use ($id, $course, $title, $d, $clean, $u) {
            run(
                "INSERT INTO quizzes(id,course_id,title,minutes,passing,max_attempts,questions,created_at) VALUES(?,?,?,?,?,?,?,?)",
                [
                    $id,
                    $course,
                    $title,
                    number($d["minutes"] ?? 30, 1, 180),
                    number($d["passing"] ?? 60, 1, 100),
                    number($d["max_attempts"] ?? 2, 1, 10),
                    json_encode($clean, JSON_UNESCAPED_UNICODE),
                    now(),
                ],
            );
            audit($u, "quiz.created", $id);
            courseUpdate(
                $course,
                "quiz",
                $id,
                "اختبار جديد: " . $title,
                "/quizzes?course=" . $course . "&quiz=" . $id,
            );
            return ["id" => $id];
        });
    }
    if ($action === "quiz") {
        $q = one("SELECT * FROM quizzes WHERE id=?", [$d["id"] ?? ""]);
        if (!$q) {
            fail(404, "الاختبار غير موجود.");
        }
        courseAccess($u, $q["course_id"], true);
        $q["questions"] = json_decode($q["questions"], true);
        return ["quiz" => $q];
    }
    if ($action === "quiz.start") {
        auth(["student"]);
        $q = one("SELECT * FROM quizzes WHERE id=?", [$d["id"] ?? ""]);
        if (!$q) {
            fail(404, "الاختبار غير موجود.");
        }
        courseAccess($u, $q["course_id"]);
        $id = tx(function () use ($q, $u) {
            lockRow("quizzes", $q["id"]);
            $active = one(
                "SELECT id FROM attempts WHERE quiz_id=? AND student_id=? AND submitted_at IS NULL",
                [$q["id"], $u["id"]],
            );
            if ($active) {
                return $active["id"];
            }
            if (
                (int) one(
                    "SELECT COUNT(*) n FROM attempts WHERE quiz_id=? AND student_id=?",
                    [$q["id"], $u["id"]],
                )["n"] >= (int) $q["max_attempts"]
            ) {
                fail(409, "استخدمت جميع المحاولات المتاحة.");
            }
            $id = uid();
            run(
                "INSERT INTO attempts(id,quiz_id,student_id,started_at,expires_at,questions,total) VALUES(?,?,?,?,?,?,?)",
                [
                    $id,
                    $q["id"],
                    $u["id"],
                    now(),
                    gmdate("Y-m-d\TH:i:s\Z", time() + $q["minutes"] * 60),
                    $q["questions"],
                    count(json_decode($q["questions"], true)),
                ],
            );
            return $id;
        });
        audit($u, "quiz.started", $id);
        return ["id" => $id];
    }
    if ($action === "quiz.attempt") {
        auth(["student"]);
        $a = one("SELECT * FROM attempts WHERE id=? AND student_id=?", [
            $d["id"] ?? "",
            $u["id"],
        ]);
        if (!$a) {
            fail(404, "المحاولة غير موجودة.");
        }
        $q = one("SELECT course_id FROM quizzes WHERE id=?", [$a["quiz_id"]]);
        courseAccess($u, $q["course_id"]);
        $questions = json_decode($a["questions"], true);
        $a["questions"] = array_map(function ($q) {
            unset($q["correct"]);
            return $q;
        }, $questions);
        unset($a["answers"]);
        return ["attempt" => $a, "server_time" => now()];
    }
    if ($action === "quiz.submit") {
        auth(["student"]);
        $answers = $d["answers"] ?? [];
        if (!is_array($answers) || count($answers) > 50) {
            fail(422, "الإجابات غير صحيحة.");
        }
        $id = str($d["id"] ?? "", 40);
        return tx(function () use ($id, $u, $answers) {
            lockRow("attempts", $id);
            $a = one("SELECT * FROM attempts WHERE id=? AND student_id=?", [
                $id,
                $u["id"],
            ]);
            if (!$a) {
                fail(404, "المحاولة غير موجودة.");
            }
            $q = one("SELECT * FROM quizzes WHERE id=?", [$a["quiz_id"]]);
            courseAccess($u, $q["course_id"]);
            if ($a["submitted_at"]) {
                return [
                    "score" => (int) $a["score"],
                    "total" => (int) $a["total"],
                ];
            }
            $expired = time() > strtotime($a["expires_at"]) + 5;
            $score = 0;
            $questions = json_decode($a["questions"], true);
            if (!$expired) {
                foreach ($questions as $i => $question) {
                    if (
                        isset($answers[$i]) &&
                        is_int($answers[$i]) &&
                        $answers[$i] === $question["correct"]
                    ) {
                        $score++;
                    }
                }
            }
            run(
                "UPDATE attempts SET answers=?,score=?,submitted_at=? WHERE id=?",
                [json_encode($answers), $score, now(), $id],
            );
            audit($u, "quiz.submitted", $id);
            return [
                "score" => $score,
                "total" => count($questions),
                "expired" => $expired,
            ];
        });
    }
    if ($action === "class.save") {
        $course = str($d["course_id"] ?? "", 40);
        courseAccess($u, $course, true);
        $start = dateInput($d["starts_at"] ?? "");
        $end = dateInput($d["ends_at"] ?? "");
        if ($end <= $start) {
            fail(422, "نهاية الحصة يجب أن تكون بعد بدايتها.");
        }
        $automation = ($d["automatic_absence"] ?? false) === true;
        $mode = $automation
            ? attendanceAutomationMode($d["attendance_mode"] ?? "manual")
            : "manual";
        if ($automation && strtotime($end) - strtotime($start) < 1200) {
            fail(
                422,
                "التغييب بعد ٢٠ دقيقة يتطلب حصة مدتها ٢٠ دقيقة على الأقل.",
            );
        }
        $id = uid();
        return tx(function () use (
            $id,
            $course,
            $start,
            $end,
            $d,
            $u,
            $automation,
            $mode,
        ) {
            run(
                "INSERT INTO classes(id,course_id,title,starts_at,ends_at,location,join_url,created_at) VALUES(?,?,?,?,?,?,?,?)",
                [
                    $id,
                    $course,
                    str($d["title"] ?? "", 200),
                    $start,
                    $end,
                    str($d["location"] ?? "", 160),
                    urlInput($d["join_url"] ?? ""),
                    now(),
                ],
            );
            audit($u, "class.created", $id);
            if ($automation) {
                attendanceAutomationCreate($id, $mode);
            }
            courseUpdate(
                $course,
                "class",
                $id,
                "حصة جديدة: " . str($d["title"] ?? "", 200),
                "/schedule?course=" . $course,
            );
            $courseTitle = one("SELECT title FROM courses WHERE id=?", [
                $course,
            ])["title"];
            $time = (new DateTimeImmutable($start))
                ->setTimezone(new DateTimeZone("Asia/Riyadh"))
                ->format("Y-m-d H:i");
            emailQueueCourse(
                $course,
                "class-created:" . $id,
                "training",
                "موعد تدريبي جديد في تفاصيل",
                $courseTitle .
                    "\n" .
                    str($d["title"] ?? "", 200) .
                    "\nالموعد بتوقيت السعودية: " .
                    $time .
                    "\nتفاصيل الحضور ورابط البث المباشر متاحة في جدولك.",
                "/schedule",
            );
            return ["id" => $id];
        });
    }
    if ($action === "attendance.save") {
        $c = one("SELECT * FROM classes WHERE id=?", [$d["class_id"] ?? ""]);
        if (!$c) {
            fail(404, "الحصة غير موجودة.");
        }
        courseAccess($u, $c["course_id"], true);
        if (strtotime($c["starts_at"]) > time() + 900) {
            fail(422, "يفتح رصد الحضور قبل الحصة بربع ساعة.");
        }
        $records = $d["records"] ?? [];
        if (!is_array($records) || count($records) > 500) {
            fail(422, "سجل الحضور غير صحيح.");
        }
        tx(function () use ($records, $c, $u) {
            lockRow("classes", $c["id"]);
            foreach ($records as $r) {
                $student = $r["student_id"] ?? "";
                if (
                    !one(
                        "SELECT id FROM enrollments WHERE course_id=? AND student_id=?",
                        [$c["course_id"], $student],
                    )
                ) {
                    fail(422, "أحد الطلاب غير مسجل في الدورة.");
                }
                $status = $r["status"] ?? "";
                if (
                    !in_array(
                        $status,
                        ["present", "absent", "late", "excused"],
                        true,
                    )
                ) {
                    fail(422, "حالة الحضور غير صحيحة.");
                }
                $note = str($r["note"] ?? "", 500, false);
                $old = one(
                    "SELECT id FROM attendance WHERE class_id=? AND student_id=?",
                    [$c["id"], $student],
                );
                if ($old && mb_strlen($note) < 3) {
                    fail(422, "اذكر سبب تعديل سجل حضور محفوظ.");
                }
                if ($old) {
                    run(
                        "UPDATE attendance SET status=?,note=?,recorded_by=?,updated_at=? WHERE id=?",
                        [$status, $note, $u["id"], now(), $old["id"]],
                    );
                } else {
                    run(
                        "INSERT INTO attendance(id,class_id,student_id,status,note,recorded_by,updated_at) VALUES(?,?,?,?,?,?,?)",
                        [
                            uid(),
                            $c["id"],
                            $student,
                            $status,
                            $note,
                            $u["id"],
                            now(),
                        ],
                    );
                }
                run(
                    "DELETE FROM class_automatic_absences WHERE class_id=? AND student_id=?",
                    [$c["id"], $student],
                );
            }
            foreach ($records as $record) {
                syncAbsenceNotice(
                    $c["id"],
                    $record["student_id"],
                    $record["status"],
                );
            }
            audit($u, "attendance.saved", $c["id"]);
        });
        return ["ok" => true];
    }
    if ($action === "file.upload") {
        return uploadFile($u);
    }
    if ($action === "file") {
        downloadFile($u, str($d["id"] ?? "", 40));
    }
    if ($action === "announcement.save") {
        auth(["admin", "instructor"]);
        $course = $d["course_id"] ?? null;
        if ($course) {
            courseAccess($u, $course, true);
        } elseif ($u["role"] !== "admin") {
            fail(403, "الإعلانات العامة للإدارة فقط.");
        }
        $id = uid();
        return tx(function () use ($id, $course, $d, $u) {
            run(
                "INSERT INTO announcements(id,course_id,title,body,author_id,created_at) VALUES(?,?,?,?,?,?)",
                [
                    $id,
                    $course ?: null,
                    str($d["title"] ?? "", 200),
                    str($d["body"] ?? "", 5000),
                    $u["id"],
                    now(),
                ],
            );
            audit($u, "announcement.created", $id);
            if ($course) {
                courseUpdate(
                    $course,
                    "announcement",
                    $id,
                    "إعلان جديد: " . str($d["title"] ?? "", 200),
                    "/announcements",
                );
            }
            return ["id" => $id];
        });
    }
    if ($action === "certificate.issue") {
        auth(["admin", "instructor"]);
        $course = str($d["course_id"] ?? "", 40);
        $student = str($d["student_id"] ?? "", 40);
        courseAccess($u, $course, true);
        return tx(function () use ($u, $course, $student) {
            lockRow("courses", $course);
            $reason = certificateReason($course, $student);
            if ($reason) {
                fail(422, $reason);
            }
            $exists = one(
                "SELECT id FROM certificates WHERE course_id=? AND student_id=?",
                [$course, $student],
            );
            if ($exists) {
                return $exists;
            }
            $id = uid();
            run(
                "INSERT INTO certificates(id,course_id,student_id,serial,issued_at) VALUES(?,?,?,?,?)",
                [
                    $id,
                    $course,
                    $student,
                    "TF-" . date("Y") . "-" . strtoupper(substr(uid(), 0, 10)),
                    now(),
                ],
            );
            audit($u, "certificate.issued", $id);
            queueEmail(
                "certificate:" . $id,
                $student,
                "account",
                "شهادتك التدريبية جاهزة",
                "أصدرت إدارة تفاصيل شهادتك التدريبية. يمكنك عرضها وتنزيلها من قسم الشهادات في حسابك.",
                "/certificates",
                $course,
            );
            return ["id" => $id];
        });
    }
    if ($action === "settings.save") {
        auth(["admin"]);
        $settings = [
            "name" => str($d["name"] ?? "", 160),
            "email" => email($d["email"] ?? ""),
            "phone" => phone($d["phone"] ?? ""),
            "certificate_attendance" => number(
                $d["certificate_attendance"] ?? 75,
                0,
                100,
            ),
        ];
        setSetting("general", $settings);
        audit($u, "settings.saved");
        return ["ok" => true];
    }
    if ($action === "support.save") {
        $id = uid();
        run(
            "INSERT INTO support(id,user_id,subject,body,status,created_at) VALUES(?,?,?,?,?,?)",
            [
                $id,
                $u["id"],
                str($d["subject"] ?? "", 200),
                str($d["body"] ?? "", 5000),
                "open",
                now(),
            ],
        );
        audit($u, "support.created", $id);
        emailAdmins(
            "support:" . $id,
            "طلب دعم جديد في تفاصيل",
            "ورد طلب دعم جديد. راجع الطلب من لوحة الدعم داخل المنصة.",
            "/support",
        );
        return ["id" => $id];
    }
    if ($action === "support.reply") {
        auth(["admin"]);
        $id = str($d["id"] ?? "", 40);
        if (!one("SELECT id FROM support WHERE id=?", [$id])) {
            fail(404, "الطلب غير موجود.");
        }
        run("UPDATE support SET reply=?,status='closed' WHERE id=?", [
            str($d["reply"] ?? "", 5000),
            $id,
        ]);
        audit($u, "support.replied", $id);
        $ticket = one("SELECT user_id FROM support WHERE id=?", [$id]);
        queueEmail(
            "support-reply:" . $id . ":" . hash("sha256", (string) $d["reply"]),
            $ticket["user_id"],
            "account",
            "تم الرد على طلبك في تفاصيل",
            "أضافت إدارة المركز ردًا على طلب الدعم الخاص بك. افتح قسم الدعم للاطلاع عليه.",
            "/support",
        );
        return ["ok" => true];
    }
    fail(404, "المسار غير موجود.");
}
function certificateReason(string $course, string $student): ?string
{
    if (
        !one("SELECT id FROM enrollments WHERE course_id=? AND student_id=?", [
            $course,
            $student,
        ])
    ) {
        return "الطالب غير مسجل في الدورة.";
    }
    $lessons = rows("SELECT id FROM lessons WHERE course_id=?", [$course]);
    if (!$lessons) {
        return "أضف دروس الدورة قبل إصدار الشهادة.";
    }
    foreach ($lessons as $l) {
        if (
            !one("SELECT id FROM progress WHERE lesson_id=? AND student_id=?", [
                $l["id"],
                $student,
            ])
        ) {
            return "يجب إكمال جميع دروس الدورة.";
        }
    }
    foreach (
        rows("SELECT id,points FROM assignments WHERE course_id=?", [$course])
        as $a
    ) {
        $s = one(
            "SELECT score FROM submissions WHERE assignment_id=? AND student_id=?",
            [$a["id"], $student],
        );
        if (!$s || $s["score"] === null || $s["score"] / $a["points"] < 0.6) {
            return "يجب اجتياز واجبات الدورة وتقييمها بنسبة ٦٠٪ على الأقل.";
        }
    }
    foreach (
        rows("SELECT id,passing FROM quizzes WHERE course_id=?", [$course])
        as $q
    ) {
        $a = one(
            "SELECT MAX(100.0*score/total) score FROM attempts WHERE quiz_id=? AND student_id=? AND submitted_at IS NOT NULL",
            [$q["id"], $student],
        );
        if ($a["score"] === null || (float) $a["score"] < $q["passing"]) {
            return "يجب اجتياز اختبارات الدورة.";
        }
    }
    $classes = rows("SELECT id,ends_at FROM classes WHERE course_id=?", [
        $course,
    ]);
    $present = 0;
    $eligible = 0;
    foreach ($classes as $c) {
        if (strtotime($c["ends_at"]) > time()) {
            return "لا تصدر الشهادة قبل انتهاء جميع حصص الدورة.";
        }
        $a = one(
            "SELECT status FROM attendance WHERE class_id=? AND student_id=?",
            [$c["id"], $student],
        );
        if (!$a) {
            return "أكمل رصد حضور الطالب في جميع حصص الدورة.";
        }
        if ($a["status"] === "excused") {
            continue;
        }
        $eligible++;
        if (in_array($a["status"], ["present", "late"], true)) {
            $present++;
        }
    }
    if (
        $classes &&
        (!$eligible ||
            (100 * $present) / $eligible <
                (setting("general")["certificate_attendance"] ?? 75))
    ) {
        return "نسبة الحضور أقل من الحد المطلوب للشهادة.";
    }
    return null;
}
function uploadFile(array $u): array
{
    rate("upload:" . $u["id"], 30, 3600);
    $purpose = $_POST["purpose"] ?? "";
    $course = $_POST["course_id"] ?? null;
    $student = $_POST["student_id"] ?? null;
    if (!in_array($purpose, ["identity", "resource", "submission"], true)) {
        fail(422, "نوع المرفق غير صحيح.");
    }
    if ($purpose === "identity") {
        if (!$student) {
            fail(422, "اختر الطالب.");
        }
        studentAccess($u, $student, true);
        if ($u["role"] === "instructor") {
            fail(403, "ملفات الهوية خاصة بالطالب وولي أمره والإدارة.");
        }
        $course = null;
    }
    if ($purpose === "resource") {
        if (!$course) {
            fail(422, "اختر الدورة.");
        }
        courseAccess($u, $course, true);
        $student = null;
    }
    if ($purpose === "submission") {
        auth(["student"]);
        if (!$course) {
            fail(422, "اختر الدورة.");
        }
        courseAccess($u, $course);
        $student = $u["id"];
    }
    $f = $_FILES["file"] ?? null;
    if (
        !$f ||
        $f["error"] !== UPLOAD_ERR_OK ||
        !is_uploaded_file($f["tmp_name"])
    ) {
        fail(422, "تعذّر رفع الملف. الحد ٣٠ ميجابايت.");
    }
    $size = (int) $f["size"];
    if ($size < 1 || $size > (int) (cfg()["max_upload_bytes"] ?? 31457280)) {
        fail(413, "حجم الملف يجب ألا يتجاوز ٣٠ ميجابايت.");
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f["tmp_name"]);
    $allowed = [
        "application/pdf" => ["pdf"],
        "image/jpeg" => ["jpg", "jpeg"],
        "image/png" => ["png"],
        "image/webp" => ["webp"],
        "video/mp4" => ["mp4"],
    ];
    $ext = strtolower(pathinfo($f["name"], PATHINFO_EXTENSION));
    if (
        !isset($allowed[$mime]) ||
        !in_array($ext, $allowed[$mime], true) ||
        ($purpose === "identity" && $mime === "video/mp4")
    ) {
        fail(422, "الملفات المسموحة: PDF، JPG، PNG، WEBP، وMP4 للدروس.");
    }
    if (str_starts_with($mime, "image/") && !@getimagesize($f["tmp_name"])) {
        fail(422, "الصورة غير سليمة.");
    }
    $name = str(basename($f["name"]), 180);
    $id = uid();
    reserveUpload($id, $size);
    $storage = null;
    try {
        $storage = storeEncryptedObject(
            uid() . ".enc",
            enc(file_get_contents($f["tmp_name"])),
        );
        tx(function () use (
            $id,
            $u,
            $course,
            $student,
            $purpose,
            $name,
            $mime,
            $size,
            $storage,
        ) {
            run(
                "INSERT INTO files(id,owner_id,course_id,student_id,purpose,name,mime,bytes,storage_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                [
                    $id,
                    $u["id"],
                    $course ?: null,
                    $student ?: null,
                    $purpose,
                    $name,
                    $mime,
                    $size,
                    $storage,
                    now(),
                ],
            );
            run("DELETE FROM upload_reservations WHERE id=?", [$id]);
            if ($purpose === "resource" && $course) {
                courseUpdate(
                    $course,
                    "file",
                    $id,
                    "ملف جديد: " . $name,
                    "/files?course=" . $course,
                );
            }
        });
    } catch (Throwable $e) {
        if ($storage !== null) {
            try {
                discardObject($storage);
            } catch (Throwable) {
                error_log("Tafaseel: private upload cleanup needs review");
            }
        }
        run("DELETE FROM upload_reservations WHERE id=?", [$id]);
        throw $e;
    }
    audit($u, "file.uploaded", $id);
    return ["id" => $id, "name" => $name];
}
function downloadFile(array $u, string $id): never
{
    $f = one("SELECT * FROM files WHERE id=?", [$id]);
    if (!$f || !fileAccess($u, $f)) {
        fail(404, "الملف غير متاح.");
    }
    $content = dec(encryptedObject($f["storage_name"]));
    audit($u, "file.downloaded", $id);
    session_write_close();
    $isVideo = $f["mime"] === "video/mp4";
    header("Content-Type: " . $f["mime"]);
    header(
        "Content-Disposition: " .
            ($isVideo ? "inline" : "attachment") .
            "; filename=\"download." .
            pathinfo($f["name"], PATHINFO_EXTENSION) .
            "\"; filename*=UTF-8''" .
            rawurlencode($f["name"]),
    );
    header("Cache-Control: no-store");
    header("Content-Security-Policy: default-src 'none'; sandbox");
    $len = strlen($content);
    if ($isVideo) {
        header("Accept-Ranges: bytes");
        if (
            isset($_SERVER["HTTP_RANGE"]) &&
            preg_match('/^bytes=(\d+)-(\d*)$/', $_SERVER["HTTP_RANGE"], $m)
        ) {
            $start = (int) $m[1];
            $end = $m[2] !== "" ? min((int) $m[2], $len - 1) : $len - 1;
            if ($start > $end || $start >= $len) {
                http_response_code(416);
                header("Content-Range: bytes */$len");
                exit();
            }
            http_response_code(206);
            header("Content-Range: bytes $start-$end/$len");
            $content = substr($content, $start, $end - $start + 1);
        }
    }
    header("Content-Length: " . strlen($content));
    echo $content;
    exit();
}
