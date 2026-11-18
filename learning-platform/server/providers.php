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
    if (in_array($name, ["moyasar", "zoom", "video", "s3"], true)) {
        $stored = setting("service_connection_" . $name, "");
        if ($stored) {
            return json_decode(dec($stored), true, 16, JSON_THROW_ON_ERROR);
        }
    }
    if ($name === "sms") {
        $stored = setting("sms_connection", "");
        if ($stored) {
            return json_decode(dec($stored), true, 16, JSON_THROW_ON_ERROR);
        }
    }
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
function providerCurl(
    string $provider,
    string $method,
    string $path,
    ?array $body,
    array $headers = [],
    bool $form = false,
    ?float $deadline = null,
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
    $state = (object) ["buffer" => "", "too_large" => false];
    $timeout =
        $deadline === null
            ? 25
            : max(1, min(25, (int) ceil($deadline - microtime(true))));
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER => [
            "Accept: application/json",
            "Content-Type: " .
            ($form ? "application/x-www-form-urlencoded" : "application/json"),
            ...$headers,
        ],
        CURLOPT_WRITEFUNCTION => function ($handle, $chunk) use ($state) {
            if (strlen($state->buffer) + strlen($chunk) > 2097152) {
                $state->too_large = true;
                return 0;
            }
            $state->buffer .= $chunk;
            return strlen($chunk);
        },
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    return [$ch, $state];
}
function providerCurlResponse(
    CurlHandle $handle,
    object $state,
    int $error,
): array {
    if ($state->too_large) {
        throw new ProviderError("response_limit", true);
    }
    if ($error !== CURLE_OK) {
        throw new ProviderError("network_" . $error, true);
    }
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    if ($status < 200 || $status >= 300) {
        throw new ProviderError(
            "http_" . $status,
            $status >= 500 || $status === 408,
        );
    }
    if ($status === 204 || $state->buffer === "") {
        return [];
    }
    try {
        $data = json_decode($state->buffer, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ProviderError("response_format", true);
    }
    if (!is_array($data)) {
        throw new ProviderError("response_format", true);
    }
    return $data;
}
function providerRequest(
    string $provider,
    string $method,
    string $path,
    ?array $body,
    array $headers = [],
    bool $form = false,
): array {
    [$handle, $state] = providerCurl(
        $provider,
        $method,
        $path,
        $body,
        $headers,
        $form,
    );
    $ok = curl_exec($handle);
    $error = curl_errno($handle);
    if ($ok === false && $error === CURLE_OK) {
        throw new ProviderError("network_0", true);
    }
    return providerCurlResponse($handle, $state, $error);
}
function providerRequestBatch(
    string $provider,
    array $requests,
    ?float $deadline = null,
): array {
    if (count($requests) > 8) {
        throw new LogicException("Provider batch too large");
    }
    $multi = curl_multi_init();
    $handles = [];
    $results = [];
    try {
        foreach ($requests as $key => $request) {
            [$handle, $state] = providerCurl(
                $provider,
                $request["method"],
                $request["path"],
                $request["body"],
                $request["headers"] ?? [],
                false,
                $deadline,
            );
            $handles[$key] = [$handle, $state];
            curl_multi_add_handle($multi, $handle);
        }
        do {
            $code = curl_multi_exec($multi, $running);
            if ($code !== CURLM_OK) {
                throw new ProviderError("batch_transport", true);
            }
            if ($running) {
                if (curl_multi_select($multi, 0.25) === -1) {
                    usleep(1000);
                }
            }
        } while ($running);
        $errors = [];
        while ($info = curl_multi_info_read($multi)) {
            $errors[spl_object_id($info["handle"])] = $info["result"];
        }
        foreach ($handles as $key => [$handle, $state]) {
            try {
                $results[$key] = providerCurlResponse(
                    $handle,
                    $state,
                    $errors[spl_object_id($handle)] ?? curl_errno($handle),
                );
            } catch (ProviderError $error) {
                $results[$key] = $error;
            }
        }
    } finally {
        foreach ($handles as [$handle]) {
            curl_multi_remove_handle($multi, $handle);
        }
        curl_multi_close($multi);
    }
    return $results;
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
            "schema-v6.sql",
            "schema-v7.sql",
            "schema-v8.sql",
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
    if (!one("SELECT id FROM storage_locks WHERE id=?", ["sms"])) {
        run("INSERT INTO storage_locks(id) VALUES(?)", ["sms"]);
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
