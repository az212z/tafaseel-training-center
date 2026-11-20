<?php
declare(strict_types=1);
if (PHP_SAPI !== "cli") {
    exit(1);
}
require_once __DIR__ . "/bootstrap.php";
$path = $argv[1] ?? "";
$apply = in_array("--apply", $argv, true);
if (!$path || !is_file($path)) {
    throw new RuntimeException(
        "Provide a verified consistent SQLite snapshot. Never point at the running legacy database.",
    );
}
if (!class_exists("SQLite3")) {
    throw new RuntimeException(
        "SQLite3 PHP extension is required to read the legacy snapshot.",
    );
}
if (
    str_starts_with(cfg()["dsn"], "sqlite:") &&
    realpath(substr(cfg()["dsn"], 7)) === realpath($path)
) {
    throw new RuntimeException(
        "Source and destination must be different databases.",
    );
}
$source = new SQLite3($path, SQLITE3_OPEN_READONLY);
$source->enableExceptions(true);
function legacyRows(SQLite3 $source, string $sql): array
{
    $r = $source->query($sql);
    $out = [];
    while ($row = $r->fetchArray(SQLITE3_ASSOC)) {
        $out[] = $row;
    }
    return $out;
}
$tables = array_column(
    legacyRows($source, "SELECT name FROM sqlite_master WHERE type='table'"),
    "name",
);
foreach (
    ["students", "courses", "cohorts", "registrations", "programs"]
    as $table
) {
    if (!in_array($table, $tables, true)) {
        throw new RuntimeException(
            "Snapshot schema is not the expected legacy version.",
        );
    }
}
$students = legacyRows(
    $source,
    "SELECT id,name,email,mobile,guardian,city FROM students",
);
$courses = legacyRows(
    $source,
    "SELECT c.slug,c.title,c.description,p.short_title AS category FROM courses c JOIN programs p ON p.id=c.program_id",
);
$cohorts = legacyRows(
    $source,
    "SELECT id,course_slug,number,capacity FROM cohorts",
);
$registrations = legacyRows(
    $source,
    "SELECT id,student_id,course_slug,cohort_id FROM registrations WHERE status='registered'",
);
$summary = [
    "mode" => $apply ? "apply" : "dry-run",
    "students" => count($students),
    "catalog_courses" => count($courses),
    "cohorts" => count($cohorts),
    "active_registrations" => count($registrations),
    "note" =>
        "No legacy passwords, attendance, payments, or SMS will be imported. Student accounts start disabled.",
];
echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) .
    PHP_EOL;
if (!$apply) {
    exit();
}
db()->exec(file_get_contents(__DIR__ . "/schema.sql"));
function linked(string $kind, string $legacy): ?string
{
    return one("SELECT new_id FROM legacy_links WHERE kind=? AND legacy_id=?", [
        $kind,
        $legacy,
    ])["new_id"] ?? null;
}
function linkLegacy(
    string $kind,
    string $old,
    string $new,
    array $payload = [],
): void {
    run(
        "INSERT INTO legacy_links(id,kind,legacy_id,new_id,payload) VALUES(?,?,?,?,?)",
        [
            uid(),
            $kind,
            $old,
            $new,
            enc(json_encode($payload, JSON_UNESCAPED_UNICODE)),
        ],
    );
}
$created = ["students" => 0, "courses" => 0, "enrollments" => 0];
tx(function () use ($students, $courses, $cohorts, $registrations, &$created) {
    foreach ($students as $s) {
        if (linked("student", $s["id"])) {
            continue;
        }
        $id = uid();
        $em = strtolower(trim($s["email"]));
        if (
            !filter_var($em, FILTER_VALIDATE_EMAIL) ||
            one("SELECT id FROM users WHERE email=?", [$em])
        ) {
            $em = "import-" . $id . "@example.invalid";
        }
        run(
            "INSERT INTO users(id,name,email,password,role,active,created_at) VALUES(?,?,?,?,?,0,?)",
            [
                $id,
                $s["name"],
                $em,
                password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
                "student",
                now(),
            ],
        );
        run(
            "INSERT INTO profiles(user_id,phone,city,guardian_name,guardian_phone,identity_number,consent_at) VALUES(?,?,?,?,?,?,?)",
            [$id, "", $s["city"], enc($s["guardian"]), "", "", ""],
        );
        linkLegacy("student", $s["id"], $id, ["contact" => $s["mobile"]]);
        $created["students"]++;
    }
    foreach ($courses as $c) {
        $groups = array_values(
            array_filter($cohorts, fn($g) => $g["course_slug"] === $c["slug"]),
        );
        if (!$groups) {
            $groups = [["id" => "none", "number" => 1, "capacity" => 20]];
        }
        foreach ($groups as $g) {
            $key = $c["slug"] . "#" . $g["id"];
            if (linked("cohort", $key)) {
                continue;
            }
            $id = uid();
            $count = count(
                array_filter(
                    $registrations,
                    fn($r) => (string) $r["cohort_id"] === (string) $g["id"],
                ),
            );
            run(
                "INSERT INTO courses(id,title,description,category,image,status,duration,capacity,created_at) VALUES(?,?,?,?,?,?,0,?,?)",
                [
                    $id,
                    $c["title"] . " — المجموعة " . $g["number"],
                    $c["description"] ?: "محتوى الدورة يضاف بعد المراجعة.",
                    $c["category"],
                    "/images/courses/foundation.webp",
                    "draft",
                    max((int) $g["capacity"], $count, 1),
                    now(),
                ],
            );
            linkLegacy("cohort", $key, $id);
            $created["courses"]++;
        }
    }
    foreach ($registrations as $r) {
        if (linked("registration", $r["id"])) {
            continue;
        }
        $student = linked("student", $r["student_id"]);
        $course = linked("cohort", $r["course_slug"] . "#" . $r["cohort_id"]);
        if (!$student || !$course) {
            continue;
        }
        $existing = one(
            "SELECT id FROM enrollments WHERE student_id=? AND course_id=?",
            [$student, $course],
        );
        $id = $existing["id"] ?? uid();
        if (!$existing) {
            run(
                "INSERT INTO enrollments(id,student_id,course_id,created_at) VALUES(?,?,?,?)",
                [$id, $student, $course, now()],
            );
            $created["enrollments"]++;
        }
        linkLegacy("registration", $r["id"], $id);
    }
    audit(null, "legacy.imported");
});
echo json_encode(
    [
        "created" => $created,
        "status" =>
            "Imported into destination only. Review students, guardian data, dates of birth, trainers, and course content before activation.",
    ],
    JSON_PRETTY_PRINT,
) . PHP_EOL;
