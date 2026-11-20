<?php
// CLI-only temporary GitHub workspace. Never included as an HTTP setup endpoint.
declare(strict_types=1);
if (PHP_SAPI !== "cli") {
    exit(1);
}
$root = dirname(__DIR__);
$dir = $root . "/.local/github-trial";
$action = $argv[1] ?? "init";
$local = getenv("TAFASEEL_TRIAL_LOCAL_ORIGIN");
if ($local) {
    if (!preg_match('#^http://127\.0\.0\.1:[0-9]+$#', $local)) {
        throw new RuntimeException("Local trial origin must be loopback.");
    }
    $origin = $local;
} else {
    $name = getenv("CODESPACE_NAME") ?: "";
    $domain =
        getenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN") ?: "app.github.dev";
    if (
        getenv("CODESPACES") !== "true" ||
        !preg_match('/^[a-z0-9-]+$/', $name) ||
        $domain !== "app.github.dev"
    ) {
        throw new RuntimeException("Run this helper inside GitHub Codespaces.");
    }
    $origin = "https://" . $name . "-8080." . $domain;
}
if (!is_dir($dir) && !mkdir($dir, 0700, true)) {
    throw new RuntimeException("Cannot create private trial storage.");
}
chmod($dir, 0700);
$config = $dir . "/config.php";
putenv("TAFASEEL_CONFIG=" . $config);
if ($action === "accounts") {
    if (!is_file($config) || !is_file($dir . "/ready")) {
        throw new RuntimeException("Trial setup is incomplete.");
    }
    $accounts = json_decode(
        file_get_contents($dir . "/accounts.json"),
        true,
        32,
        JSON_THROW_ON_ERROR,
    );
    echo "\nبيانات دخول التجربة الخاصة — لا تشاركها أو تحفظها في GitHub\n\n";
    $seen = [];
    foreach ($accounts as $em => $account) {
        if (isset($seen[$account["role"]])) {
            continue;
        }
        $seen[$account["role"]] = true;
        echo $account["role"] .
            ": " .
            $em .
            "\n" .
            $account["password"] .
            "\n\n";
    }
    echo "المنصة: " .
        $origin .
        "\nالمصادقة الثنائية مطلوبة للإدارة والمدربين.\nاستخدم بيانات وملفات اختبار فقط.\n";
    exit();
}
if ($action !== "init") {
    throw new RuntimeException("Unknown trial command.");
}
$lock = fopen($dir . "/setup.lock", "c");
if (!$lock || !flock($lock, LOCK_EX)) {
    throw new RuntimeException("Cannot lock trial setup.");
}
if (is_file($config) && !is_file($dir . "/ready")) {
    throw new RuntimeException(
        "An incomplete setup exists. Review private bootstrap logs; data was not reset.",
    );
}
$fresh = !is_file($config);
if ($fresh) {
    $env = getenv();
    $env["TAFASEEL_CONFIG"] = $config;
    $env["TAFASEEL_DEMO_DIR"] = $dir;
    $log = fopen($dir . "/bootstrap.log", "a");
    $proc = proc_open(
        [PHP_BINARY, __DIR__ . "/console.php", "demo"],
        [["pipe", "r"], $log, $log],
        $pipes,
        $root,
        $env,
    );
    if (!is_resource($proc)) {
        throw new RuntimeException("Cannot initialize trial.");
    }
    fclose($pipes[0]);
    $code = proc_close($proc);
    fclose($log);
    if ($code !== 0) {
        throw new RuntimeException(
            "Trial seed failed. Review .local/github-trial/bootstrap.log.",
        );
    }
}
$c = require $config;
if (
    ($c["dsn"] ?? "") !== "sqlite:" . $dir . "/learning.sqlite" ||
    ($c["storage"] ?? "") !== $dir . "/storage"
) {
    throw new RuntimeException(
        "Unexpected trial storage; refusing to overwrite configuration.",
    );
}
$c["environment"] = $local ? "local" : "production";
$c["demo"] = false;
$c["origin"] = $origin;
$c["enforce_staff_mfa"] = true;
$c["registration_enabled"] = true;
$c["max_upload_bytes"] = 31457280;
$c["storage_quota_bytes"] = 536870912;
// Provider credentials may be added privately later. A restart never erases them.
$c["integrations"] ??= [];
$temp = $config . ".tmp";
file_put_contents($temp, "<?php return " . var_export($c, true) . ";", LOCK_EX);
chmod($temp, 0600);
rename($temp, $config);
require_once __DIR__ . "/api.php";
migrateSchema();
if ($fresh) {
    $accounts = json_decode(
        file_get_contents($dir . "/accounts.json"),
        true,
        32,
        JSON_THROW_ON_ERROR,
    );
    tx(function () use (&$accounts) {
        foreach ($accounts as &$account) {
            $account["password"] = bin2hex(random_bytes(16));
            run("UPDATE users SET password=? WHERE id=?", [
                password_hash($account["password"], PASSWORD_DEFAULT),
                $account["id"],
            ]);
        }
    });
    file_put_contents(
        $dir . "/accounts.json",
        json_encode($accounts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX,
    );
    chmod($dir . "/accounts.json", 0600);
    audit(null, "github_trial.initialized");
    file_put_contents($dir . "/ready", now(), LOCK_EX);
    chmod($dir . "/ready", 0600);
}
flock($lock, LOCK_UN);
fclose($lock);
echo json_encode(
    [
        "ok" => true,
        "created" => $fresh,
        "origin" => $origin,
        "demo_login" => false,
        "staff_mfa_required" => true,
        "users" => (int) one("SELECT COUNT(*) n FROM users")["n"],
    ],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT,
) . PHP_EOL;
