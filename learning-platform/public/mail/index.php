<?php
declare(strict_types=1);
ini_set("display_errors", "0");
header("Content-Type: text/html; charset=utf-8");
header("Cache-Control: no-store, private");
header("Referrer-Policy: no-referrer");
header("X-Robots-Tag: noindex, nofollow");
try {
    $private =
        getenv("TAFASEEL_PRIVATE_DIR") ?:
        dirname(__DIR__, 2) . "/tafaseel-learning-private";
    require_once $private . "/api.php";
    $token = is_string($_GET["token"] ?? null) ? $_GET["token"] : "";
    $id = emailUnsubscribeUser($token);
    if (!$id) {
        throw new RuntimeException("invalid");
    }
    $done = false;
    if ($_SERVER["REQUEST_METHOD"] === "POST") {
        tx(fn() => saveEmailPreference($id, false, false));
        $done = true;
    }
    $title = $done ? "تم إيقاف التنبيهات الاختيارية" : "إدارة اشتراك البريد";
    $description = $done
        ? "حُفظ تفضيلك. يمكنك إعادة تفعيل الرسائل من إعدادات حسابك."
        : "يمكنك إيقاف نشرات المركز وتنبيهات التدريب الاختيارية. تبقى رسائل حالة حسابك وطلبات الدعم والشهادات متاحة.";
    $form = $done
        ? ""
        : '<form method="post"><button type="submit">إيقاف الرسائل الاختيارية</button></form>';
} catch (Throwable $e) {
    http_response_code(400);
    $title = "رابط غير صالح";
    $description =
        "افتح رابط إدارة الاشتراك من إحدى رسائل تفاصيل، أو غيّر تفضيلات البريد من حسابك.";
    $form = "";
}
?><!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= htmlspecialchars(
    $title,
) ?> | تفاصيل</title><link rel="stylesheet" href="/mail/style.css"></head><body><main><a href="/" class="brand">تفاصيل</a><h1><?= htmlspecialchars(
     $title,
 ) ?></h1><p><?= htmlspecialchars(
    $description,
) ?></p><?= $form ?><a href="/communications">العودة إلى حسابي</a></main></body></html>
