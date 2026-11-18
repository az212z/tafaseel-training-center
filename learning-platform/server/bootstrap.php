<?php
declare(strict_types=1);
require_once __DIR__ . "/database-connection.php";
require_once __DIR__ . "/record-trash.php";
final class ApiError extends RuntimeException
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}
function fail(int $status, string $message): never
{
    throw new ApiError($status, $message);
}
function cfg(): array
{
    static $c;
    if ($c !== null) {
        return $c;
    }
    $path = getenv("TAFASEEL_CONFIG") ?: __DIR__ . "/config.php";
    if (!is_file($path)) {
        throw new RuntimeException("Configuration missing. Run setup.");
    }
    $c = require $path;
    if (!is_array($c) || !preg_match('/^[a-f0-9]{64}$/', $c["key"] ?? "")) {
        throw new RuntimeException("Invalid encryption configuration.");
    }
    if (
        ($c["environment"] ?? "production") === "production" &&
        (!str_starts_with($c["origin"] ?? "", "https://") ||
            ($c["demo"] ?? false))
    ) {
        throw new RuntimeException("Unsafe production configuration.");
    }
    return $c;
}
function db(): PDO
{
    static $p;
    if ($p) {
        return $p;
    }
    $c = cfg();
    $persistent =
        str_starts_with($c["dsn"], "mysql:") &&
        ($c["database_persistent"] ??
            ($c["environment"] ?? "production") === "production" &&
                PHP_SAPI !== "cli");
    $p = connectDatabase(
        fn() => new PDO(
            $c["dsn"],
            $c["db_user"] ?? null,
            $c["db_password"] ?? null,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => $persistent,
            ],
        ),
        $persistent,
    );
    if ($p->getAttribute(PDO::ATTR_DRIVER_NAME) === "sqlite") {
        $p->exec(
            "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;",
        );
    }
    return $p;
}
function rows(string $sql, array $params = []): array
{
    $s = db()->prepare($sql);
    $s->execute($params);
    return $s->fetchAll();
}
function one(string $sql, array $params = []): ?array
{
    return rows($sql, $params)[0] ?? null;
}
function run(string $sql, array $params = []): void
{
    $s = db()->prepare($sql);
    $s->execute($params);
}
function tx(callable $fn): mixed
{
    $p = db();
    $sqlite = $p->getAttribute(PDO::ATTR_DRIVER_NAME) === "sqlite";
    $sqlite ? $p->exec("BEGIN IMMEDIATE") : $p->beginTransaction();
    try {
        $r = $fn();
        $sqlite ? $p->exec("COMMIT") : $p->commit();
        return $r;
    } catch (Throwable $e) {
        $sqlite ? $p->exec("ROLLBACK") : $p->rollBack();
        throw $e;
    }
}
function uid(): string
{
    return bin2hex(random_bytes(16));
}
function now(): string
{
    return gmdate("Y-m-d\TH:i:s\Z");
}
function enc(?string $v): string
{
    if (!$v) {
        return "";
    }
    $iv = random_bytes(12);
    $tag = "";
    $cipher = openssl_encrypt(
        $v,
        "aes-256-gcm",
        hex2bin(cfg()["key"]),
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
    );
    if ($cipher === false) {
        throw new RuntimeException("Encryption failed");
    }
    return base64_encode($iv . $tag . $cipher);
}
function dec(?string $v): string
{
    if (!$v) {
        return "";
    }
    $s = base64_decode($v, true);
    if ($s === false || strlen($s) < 28) {
        throw new RuntimeException("Invalid encrypted data");
    }
    $plain = openssl_decrypt(
        substr($s, 28),
        "aes-256-gcm",
        hex2bin(cfg()["key"]),
        OPENSSL_RAW_DATA,
        substr($s, 0, 12),
        substr($s, 12, 16),
    );
    if ($plain === false) {
        throw new RuntimeException("Cannot decrypt data");
    }
    return $plain;
}
function str(mixed $v, int $max = 200, bool $required = true): string
{
    if (!is_string($v)) {
        fail(422, "تحقق من الحقول المطلوبة.");
    }
    $v = trim($v);
    if (
        strlen($v) > 60000 ||
        mb_strlen($v) > $max ||
        ($required && mb_strlen($v) < 2) ||
        preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', $v)
    ) {
        fail(422, "أحد الحقول غير مكتمل أو تجاوز الطول المسموح.");
    }
    return $v;
}
function number(mixed $v, int $min, int $max): int
{
    if (
        filter_var($v, FILTER_VALIDATE_INT) === false ||
        (int) $v < $min ||
        (int) $v > $max
    ) {
        fail(422, "أدخل رقمًا بين $min و$max.");
    }
    return (int) $v;
}
function digits(string $v): string
{
    return strtr(
        $v,
        array_combine(
            preg_split("//u", "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", -1, PREG_SPLIT_NO_EMPTY),
            str_split("01234567890123456789"),
        ),
    );
}
function phone(mixed $v, bool $required = true): string
{
    $s = preg_replace("/[\s()\-]/u", "", digits(str($v ?? "", 25, false)));
    if (!$s && !$required) {
        return "";
    }
    if (preg_match('/^05\d{8}$/', $s)) {
        return "+966" . substr($s, 1);
    }
    if (preg_match('/^(?:\+?966|00966)5\d{8}$/', $s)) {
        return "+966" . substr($s, -9);
    }
    fail(422, "أدخل رقم جوال سعودي صحيحًا.");
}
function email(mixed $v): string
{
    $e = strtolower(str($v, 190));
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) {
        fail(422, "البريد الإلكتروني غير صحيح.");
    }
    return $e;
}
function pass(mixed $v): string
{
    $p = str($v, 128);
    if (strlen($p) < 12 || strlen($p) > 72) {
        fail(422, "استخدم كلمة مرور من ١٢ حرفًا على الأقل وبحد أقصى ٧٢ بايت.");
    }
    return $p;
}
function dateInput(mixed $v): string
{
    $s = str($v, 40);
    $t = strtotime($s);
    if ($t === false) {
        fail(422, "التاريخ غير صحيح.");
    }
    return gmdate("Y-m-d\TH:i:s\Z", $t);
}
function urlInput(mixed $v, array $hosts = []): string
{
    $s = str($v ?? "", 1000, false);
    if (!$s) {
        return "";
    }
    if (
        !filter_var($s, FILTER_VALIDATE_URL) ||
        parse_url($s, PHP_URL_SCHEME) !== "https" ||
        parse_url($s, PHP_URL_USER) ||
        parse_url($s, PHP_URL_PASS)
    ) {
        fail(422, "استخدم رابط HTTPS صحيحًا.");
    }
    if (
        $hosts &&
        !in_array(strtolower(parse_url($s, PHP_URL_HOST) ?? ""), $hosts, true)
    ) {
        fail(422, "أضف رابطًا من YouTube أو Vimeo، أو ارفع ملف الفيديو مباشرة.");
    }
    if ($hosts) {
        $host = strtolower(parse_url($s, PHP_URL_HOST) ?? "");
        $path = parse_url($s, PHP_URL_PATH) ?? "";
        $valid = false;
        if (in_array($host, ["youtube.com", "www.youtube.com"], true)) {
            parse_str(parse_url($s, PHP_URL_QUERY) ?? "", $query);
            $id = $query["v"] ?? basename($path);
            $valid = preg_match('/^[a-zA-Z0-9_-]{11}$/', (string) $id) === 1;
        } elseif ($host === "youtu.be") {
            $valid = preg_match('#^/[a-zA-Z0-9_-]{11}/?$#', $path) === 1;
        } elseif (in_array($host, ["vimeo.com", "www.vimeo.com"], true)) {
            $valid = preg_match('#^/[0-9]+/?$#', $path) === 1;
        }
        if (!$valid) {
            fail(422, "رابط الفيديو لا يحتوي رقم مقطع صالحًا.");
        }
    }
    return $s;
}
function audit(
    array|string|null $u,
    string $action,
    ?string $entity = null,
): void {
    run(
        "INSERT INTO audit(id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?)",
        [uid(), is_array($u) ? $u["id"] : $u, $action, $entity, now()],
    );
}
function setting(string $key, mixed $default = null): mixed
{
    $r = one("SELECT value FROM settings WHERE setting_key=?", [$key]);
    return $r ? json_decode($r["value"], true) : $default;
}
function setSetting(string $key, mixed $value): void
{
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql") {
        run(
            "INSERT INTO settings(setting_key,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
            [$key, $json],
        );
    } else {
        run(
            "INSERT INTO settings(setting_key,value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value",
            [$key, $json],
        );
    }
}
function rate(string $key, int $max, int $seconds): void
{
    $bucket = hash_hmac("sha256", $key, cfg()["key"]);
    $hits = tx(function () use ($bucket, $seconds) {
        $time = time();
        if (db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql") {
            run(
                "INSERT INTO rate_limits(bucket,hits,expires) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=IF(expires<?,1,hits+1),expires=IF(expires<?,?,expires)",
                [$bucket, $time + $seconds, $time, $time, $time + $seconds],
            );
        } else {
            run(
                "INSERT INTO rate_limits(bucket,hits,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN rate_limits.expires<? THEN 1 ELSE rate_limits.hits+1 END,expires=CASE WHEN rate_limits.expires<? THEN ? ELSE rate_limits.expires END",
                [$bucket, $time + $seconds, $time, $time, $time + $seconds],
            );
        }
        return (int) one("SELECT hits FROM rate_limits WHERE bucket=?", [
            $bucket,
        ])["hits"];
    });
    if ($hits > $max) {
        fail(429, "محاولات كثيرة. حاول لاحقًا.");
    }
}
function sessionStart(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = cfg()["environment"] === "production";
    $dir = cfg()["storage"] . "/sessions";
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    ini_set("session.use_strict_mode", "1");
    ini_set("session.use_only_cookies", "1");
    ini_set("session.gc_maxlifetime", "28800");
    session_save_path($dir);
    session_name($secure ? "__Host-tafaseel_learn" : "tafaseel_learn_local");
    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => $secure,
        "httponly" => true,
        "samesite" => "Strict",
    ]);
    session_start();
    if (!isset($_SESSION["csrf"])) {
        $_SESSION["csrf"] = bin2hex(random_bytes(32));
    }
}
function publicUser(array $u): array
{
    $public = array_intersect_key(
        $u,
        array_flip(["id", "name", "email", "role", "active", "created_at"]),
    );
    if ($u["role"] === "admin") {
        $login = setting("admin_login", []);
        if (($login["user_id"] ?? "") === $u["id"]) {
            $public["username"] = $login["username"];
        }
    }
    return $public;
}
function currentUser(bool $touch = true): ?array
{
    sessionStart();
    if (!isset($_SESSION["uid"])) {
        return null;
    }
    if (
        time() - ($_SESSION["last"] ?? 0) > 1800 ||
        time() - ($_SESSION["login"] ?? 0) > 28800
    ) {
        unset($_SESSION["uid"]);
        return null;
    }
    $u = one("SELECT * FROM users WHERE id=? AND active=1", [$_SESSION["uid"]]);
    if (!$u || $u["auth_version"] !== ($_SESSION["version"] ?? 0)) {
        unset($_SESSION["uid"]);
        return null;
    }
    if ($touch) {
        $_SESSION["last"] = time();
    }
    return publicUser($u);
}
function auth(array $roles = [], bool $touch = true): array
{
    $u = currentUser($touch);
    if (!$u) {
        fail(401, "سجّل الدخول للمتابعة.");
    }
    if ($roles && !in_array($u["role"], $roles, true)) {
        fail(403, "ليست لديك صلاحية لهذا الإجراء.");
    }
    return $u;
}
function loginUser(array $u): array
{
    sessionStart();
    session_regenerate_id(true);
    $_SESSION = [
        "uid" => $u["id"],
        "version" => $u["auth_version"],
        "last" => time(),
        "login" => time(),
        "csrf" => bin2hex(random_bytes(32)),
    ];
    audit($u, "session.login");
    return ["user" => publicUser($u), "csrf" => $_SESSION["csrf"]];
}
function csrf(): void
{
    sessionStart();
    if (!hash_equals($_SESSION["csrf"], $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "")) {
        fail(403, "انتهت صلاحية النموذج. حدّث الصفحة ثم حاول.");
    }
    $origin = $_SERVER["HTTP_ORIGIN"] ?? "";
    if ($origin !== cfg()["origin"]) {
        fail(403, "مصدر الطلب غير مسموح.");
    }
}
function courseAccess(array $u, string $id, bool $write = false): array
{
    guardActiveRecord("course", $id);
    $c = one("SELECT * FROM courses WHERE id=?", [$id]);
    if (!$c) {
        fail(404, "الدورة غير موجودة.");
    }
    if (
        $u["role"] === "admin" ||
        ($u["role"] === "instructor" && $c["instructor_id"] === $u["id"])
    ) {
        return $c;
    }
    if ($write) {
        fail(403, "ليست لديك صلاحية تعديل هذه الدورة.");
    }
    if ($c["status"] !== "published") {
        fail(404, "الدورة غير متاحة.");
    }
    if (
        $u["role"] === "student" &&
        one("SELECT id FROM enrollments WHERE course_id=? AND student_id=?", [
            $id,
            $u["id"],
        ])
    ) {
        return $c;
    }
    if (
        $u["role"] === "guardian" &&
        one(
            "SELECT e.id FROM enrollments e JOIN profiles p ON p.user_id=e.student_id WHERE e.course_id=? AND p.guardian_id=?",
            [$id, $u["id"]],
        )
    ) {
        return $c;
    }
    fail(403, "هذه الدورة غير مسجلة في حسابك.");
}
function studentAccess(array $u, string $id, bool $sensitive = false): array
{
    guardActiveRecord("account", $id);
    $s = one(
        "SELECT id,name,email,role,active,created_at FROM users WHERE id=? AND role='student'",
        [$id],
    );
    if (!$s) {
        fail(404, "ملف الطالب غير موجود.");
    }
    if (
        $u["role"] === "admin" ||
        $u["id"] === $id ||
        ($u["role"] === "guardian" &&
            one(
                "SELECT user_id FROM profiles WHERE user_id=? AND guardian_id=?",
                [$id, $u["id"]],
            ))
    ) {
        return $s;
    }
    if (
        !$sensitive &&
        $u["role"] === "instructor" &&
        one(
            "SELECT e.id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND c.instructor_id=?",
            [$id, $u["id"]],
        )
    ) {
        return $s;
    }
    fail(403, "ليس لديك وصول إلى ملف هذا الطالب.");
}
function lockRow(string $table, string $id): void
{
    if (
        !in_array(
            $table,
            [
                "courses",
                "quizzes",
                "attempts",
                "classes",
                "orders",
                "notification_outbox",
                "email_outbox",
                "video_assets",
                "storage_locks",
                "users",
                "website_inquiries",
            ],
            true,
        )
    ) {
        throw new RuntimeException("Invalid lock");
    }
    one(
        "SELECT id FROM $table WHERE id=?" .
            (db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql"
                ? " FOR UPDATE"
                : ""),
        [$id],
    );
}
function fileAccess(array $u, array $f): bool
{
    if ($f["purpose"] === "resource" && $f["course_id"]) {
        courseAccess($u, $f["course_id"]);
        return true;
    }
    if ($u["role"] === "admin" || $f["owner_id"] === $u["id"]) {
        return true;
    }
    if ($f["purpose"] === "identity") {
        if (!$f["student_id"]) {
            return false;
        }
        studentAccess($u, $f["student_id"], true);
        return true;
    }
    if ($f["purpose"] === "submission") {
        if ($f["student_id"] === $u["id"]) {
            return true;
        }
        if ($f["student_id"] && $u["role"] === "guardian") {
            studentAccess($u, $f["student_id"]);
            return true;
        }
        if ($f["course_id"] && $u["role"] === "instructor") {
            courseAccess($u, $f["course_id"], true);
            return true;
        }
        return false;
    }
    if ($f["course_id"]) {
        courseAccess($u, $f["course_id"]);
        return true;
    }
    return $f["student_id"] === $u["id"];
}
function b32decode(string $v): string
{
    $alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    $bits = "";
    foreach (str_split(strtoupper($v)) as $c) {
        $i = strpos($alphabet, $c);
        if ($i === false) {
            fail(422, "مفتاح المصادقة غير صحيح.");
        }
        $bits .= str_pad(decbin($i), 5, "0", STR_PAD_LEFT);
    }
    $o = "";
    for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
        $o .= chr(bindec(substr($bits, $i, 8)));
    }
    return $o;
}
function totpStep(string $secret, string $code, int $last = 0): int
{
    if (!preg_match('/^\d{6}$/', $code)) {
        return 0;
    }
    $counter = (int) floor(time() / 30);
    for ($i = -1; $i <= 1; $i++) {
        $n = $counter + $i;
        if ($n <= $last) {
            continue;
        }
        $h = hash_hmac("sha1", pack("N2", 0, $n), b32decode($secret), true);
        $offset = ord($h[19]) & 15;
        $v = (unpack("N", substr($h, $offset, 4))[1] & 0x7fffffff) % 1000000;
        if (hash_equals(str_pad((string) $v, 6, "0", STR_PAD_LEFT), $code)) {
            return $n;
        }
    }
    return 0;
}
