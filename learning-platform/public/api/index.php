<?php
declare(strict_types=1);
ini_set("display_errors", "0");
ini_set("log_errors", "1");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, private");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: strict-origin-when-cross-origin");
$requestId = bin2hex(random_bytes(12));
header("X-Request-ID: " . $requestId);
try {
    $private =
        getenv("TAFASEEL_PRIVATE_DIR") ?:
        dirname(__DIR__, 2) . "/tafaseel-learning-private";
    require_once $private . "/api.php";
    $method = $_SERVER["REQUEST_METHOD"];
    $action = $_GET["action"] ?? "health";
    if (
        !is_string($action) ||
        !preg_match('/^[a-z][a-z0-9.]{0,80}$/', $action)
    ) {
        fail(400, "عنوان الطلب غير صالح.");
    }
    if (
        $method === "POST" &&
        str_starts_with($_SERVER["CONTENT_TYPE"] ?? "", "multipart/form-data")
    ) {
        $d = $_POST;
    } elseif ($method === "POST") {
        if (
            !str_starts_with($_SERVER["CONTENT_TYPE"] ?? "", "application/json")
        ) {
            fail(415, "صيغة الطلب غير صحيحة.");
        }
        $raw = file_get_contents("php://input", false, null, 0, 131073);
        if (strlen($raw) > 131072) {
            fail(413, "الطلب أكبر من المسموح.");
        }
        try {
            $d = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            fail(400, "تعذّر قراءة الطلب.");
        }
        if (!is_array($d)) {
            fail(400, "صيغة الطلب غير صحيحة.");
        }
    } else {
        $d = $_GET;
    }
    $result = api($action, $method, $d, $raw ?? "");
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    $status =
        $e instanceof ApiError
            ? $e->status
            : ($e instanceof DatabaseBusyException
                ? 503
                : ($e instanceof ProviderError
                    ? 502
                    : 500));
    http_response_code($status);
    if ($status === 503) {
        header("Retry-After: 3");
    }
    if ($status === 500) {
        error_log(
            json_encode(
                [
                    "service" => "tafaseel-api",
                    "request_id" => $requestId,
                    "exception" => get_class($e),
                    "file" => basename($e->getFile()),
                    "line" => $e->getLine(),
                    ...$e instanceof PDOException
                        ? [
                            "sqlstate" => $e->errorInfo[0] ?? $e->getCode(),
                            "driver_code" => $e->errorInfo[1] ?? null,
                        ]
                        : [],
                ],
                JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
            ),
        );
    }
    echo json_encode(
        [
            "error" =>
                $status === 500
                    ? "تعذّر إتمام العملية. راجع إدارة المنصة برقم المتابعة: " .
                        $requestId
                    : $e->getMessage(),
        ],
        JSON_UNESCAPED_UNICODE,
    );
}
