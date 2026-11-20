<?php
declare(strict_types=1);

function smsConnectionStatus(): array
{
    auth(["admin"]);
    $c = integrationConfig("sms");
    return [
        "provider" => "تقنيات Taqnyat",
        "configured" => integrationEnabled("sms"),
        "enabled" => (bool) ($c["enabled"] ?? false),
        "has_token" => !empty($c["token"]),
        "sender" => $c["sender"] ?? "",
    ];
}

function saveSmsConnection(array $u, array $d): array
{
    auth(["admin"]);
    rate("sms-connection:" . $u["id"], 5, 900);
    $password = str($d["current_password"] ?? "", 128);
    $account = one("SELECT password FROM users WHERE id=?", [$u["id"]]);
    if (!password_verify($password, $account["password"])) {
        fail(422, "كلمة مرور الإدارة غير صحيحة.");
    }
    $old = integrationConfig("sms");
    $token = str($d["token"] ?? "", 2000, false) ?: $old["token"] ?? "";
    $sender = str($d["sender"] ?? "", 20, false);
    $enabled = ($d["enabled"] ?? false) === true;
    if ($enabled && (!$token || !$sender)) {
        fail(422, "أضف مفتاح تقنيات واسم المرسل المعتمد قبل التفعيل.");
    }
    if ($sender && !preg_match('/^[A-Za-z0-9 ._-]{2,20}$/', $sender)) {
        fail(422, "أدخل اسم المرسل المعتمد باللغة الإنجليزية.");
    }
    setSetting(
        "sms_connection",
        enc(
            json_encode(
                ["enabled" => $enabled, "token" => $token, "sender" => $sender],
                JSON_THROW_ON_ERROR,
            ),
        ),
    );
    audit($u, "sms.connection_saved");
    if ($enabled) {
        run(
            "UPDATE notification_outbox SET next_attempt_at=? WHERE status='blocked'",
            [now()],
        );
    }
    return smsConnectionStatus();
}
