<?php
declare(strict_types=1);
final class ProviderError extends RuntimeException
{
    public function __construct(
        public string $reason,
        public bool $uncertain = false,
    ) {
        parent::__construct("تعذّر إتمام طلب الخدمة. الرمز: " . $reason);
    }
}
function integrationConfig(string $name): array
{
    return cfg()["integrations"][$name] ?? [];
}
function integrationEnabled(string $name): bool
{
    $c = integrationConfig($name);
    if (!($c["enabled"] ?? false)) {
        return false;
    }
    $required = match ($name) {
        "moyasar" => ["secret_key"],
        "sms" => ["token", "sender"],
        "zoom" => [
            "account_id",
            "client_id",
            "client_secret",
            "webhook_secret",
        ],
        "video" => ["library_id", "api_key", "token_key"],
        "s3" => ["bucket", "region", "access_key", "secret_key"],
        default => [],
    };
    foreach ($required as $key) {
        if (empty($c[$key])) {
            return false;
        }
    }
    return true;
}
function requireIntegration(string $name): array
{
    if (!integrationEnabled($name)) {
        fail(
            503,
            "الخدمة غير مفعّلة بعد. راجع إعداد حساب المركز لدى مزود الخدمة.",
        );
    }
    return integrationConfig($name);
}
function providerBase(string $name): string
{
    $normal = match ($name) {
        "moyasar" => "https://api.moyasar.com/v1",
        "sms" => "https://api.taqnyat.sa/v1",
        "zoom" => "https://api.zoom.us/v2",
        "zoom_auth" => "https://zoom.us",
        "video" => "https://video.bunnycdn.com",
        default => throw new LogicException("Unknown provider"),
    };
    $test = cfg()["test_provider_urls"][$name] ?? null;
    if ($test !== null) {
        if (
            cfg()["environment"] !== "local" ||
            !(cfg()["testing"] ?? false) ||
            !preg_match(
                '#^http://127\.0\.0\.1:[0-9]+(?:/[a-z0-9_-]+)?$#',
                $test,
            )
        ) {
            throw new RuntimeException("Unsafe provider override");
        }
        return $test;
    }
    return $normal;
}
function providerRequest(
    string $provider,
    string $method,
    string $path,
    ?array $body,
    array $headers = [],
    bool $form = false,
): array {
    if (!str_starts_with($path, "/") || str_contains($path, "..")) {
        throw new LogicException("Unsafe provider path");
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    $ch = curl_init(providerBase($provider) . $path);
    $payload =
        $body === null
            ? null
            : ($form
                ? http_build_query($body)
                : json_encode(
                    $body,
                    JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
                ));
    $buffer = "";
    $tooLarge = false;
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER => [
            "Accept: application/json",
            "Content-Type: " .
            ($form ? "application/x-www-form-urlencoded" : "application/json"),
            ...$headers,
        ],
        CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (
            &$buffer,
            &$tooLarge,
        ) {
            if (strlen($buffer) + strlen($chunk) > 2097152) {
                $tooLarge = true;
                return 0;
            }
            $buffer .= $chunk;
            return strlen($chunk);
        },
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    $ok = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errno = curl_errno($ch);

    if ($tooLarge) {
        throw new ProviderError("response_limit", true);
    }
    if ($ok === false) {
        throw new ProviderError("network_" . $errno, true);
    }
    if ($status < 200 || $status >= 300) {
        throw new ProviderError(
            "http_" . $status,
            $status >= 500 || $status === 408,
        );
    }
    if ($status === 204 || $buffer === "") {
        return [];
    }
    try {
        $data = json_decode($buffer, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ProviderError("response_format", true);
    }
    if (!is_array($data)) {
        throw new ProviderError("response_format", true);
    }
    return $data;
}
function integrationStatuses(): array
{
    $out = [];
    foreach (["moyasar", "sms", "zoom", "video", "s3"] as $key) {
        $out[$key] = [
            "configured" => integrationEnabled($key),
            "mode" => integrationEnabled($key)
                ? ($key === "moyasar"
                    ? integrationConfig($key)["mode"] ?? "test"
                    : "configured")
                : "not_configured",
        ];
    }
    $out["email"] = [
        "configured" => emailReady(),
        "mode" => emailReady() ? "configured" : "not_configured",
    ];
    return $out;
}
function migrateSchema(): void
{
    foreach (
        [
            "schema.sql",
            "schema-v2.sql",
            "schema-v3.sql",
            "schema-v4.sql",
            "schema-v5.sql",
        ]
        as $name
    ) {
        $sql = file_get_contents(__DIR__ . "/" . $name);
        foreach (explode(";", $sql) as $statement) {
            $statement = trim($statement);
            if (!$statement) {
                continue;
            }
            if (
                db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql" &&
                preg_match(
                    "/^CREATE INDEX IF NOT EXISTS ([a-z_]+) ON ([a-z_]+)/i",
                    $statement,
                    $m,
                )
            ) {
                if (
                    one(
                        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?",
                        [$m[2], $m[1]],
                    )
                ) {
                    continue;
                }
                $statement = str_replace(
                    "CREATE INDEX IF NOT EXISTS",
                    "CREATE INDEX",
                    $statement,
                );
            }
            db()->exec($statement);
        }
    }
    if (!one("SELECT id FROM storage_locks WHERE id=?", ["files"])) {
        run("INSERT INTO storage_locks(id) VALUES(?)", ["files"]);
    }
    if (!one("SELECT id FROM storage_locks WHERE id=?", ["email"])) {
        run("INSERT INTO storage_locks(id) VALUES(?)", ["email"]);
    }
}

function staffNeedsMfa(array $u): bool
{
    return cfg()["environment"] === "production" &&
        (cfg()["enforce_staff_mfa"] ?? true) &&
        (cfg()["staff_mfa_enabled"] ?? true) &&
        in_array($u["role"], ["admin", "instructor"], true) &&
        empty(
            one("SELECT mfa_secret FROM users WHERE id=?", [$u["id"]])[
                "mfa_secret"
            ]
        );
}
function staffMfaGuard(array $u, string $action): void
{
    if (
        staffNeedsMfa($u) &&
        !in_array(
            $action,
            ["data", "logout", "mfa.begin", "mfa.confirm", "password"],
            true,
        )
    ) {
        fail(
            403,
            "فعّل المصادقة الثنائية من الإعدادات قبل إدارة بيانات المنصة.",
        );
    }
}
