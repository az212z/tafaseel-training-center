<?php
declare(strict_types=1);
ini_set("display_errors", "0");
ini_set("log_errors", "1");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, private");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: strict-origin-when-cross-origin");
try {
    $private =
        getenv("TAFASEEL_PRIVATE_DIR") ?:
        dirname(__DIR__, 2) . "/tafaseel-learning-private";
    require_once $private . "/api.php";
    $method = $_SERVER["REQUEST_METHOD"];
    $action = $_GET["action"] ?? "health";
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
            : ($e instanceof ProviderError
                ? 502
                : 500);
    http_response_code($status);
    if ($status === 500) {
        error_log(
            "Tafaseel API: " .
                get_class($e) .
                " at " .
                $e->getFile() .
                ":" .
                $e->getLine(),
        );
    }
    echo json_encode(
        [
            "error" =>
                $status === 500
                    ? "تعذّر إتمام العملية. راجع إدارة المنصة."
                    : $e->getMessage(),
        ],
        JSON_UNESCAPED_UNICODE,
    );
}
