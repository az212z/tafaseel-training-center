<?php
declare(strict_types=1);

function deliveryLimits(): array
{
    $saved = setting("delivery_limits", []);
    $limits = $saved + [
        "mail_plan" => "free",
        "mail_per_minute" => 5,
        "mail_reserved_percent" => 25,
        "sms_per_minute" => 200,
        "sms_parallel" => 4,
    ];
    $limits["mail_daily_ceiling"] =
        ["free" => 80, "starter" => 900, "standard" => 2700, "premium" => 2700][
            $limits["mail_plan"]
        ] ?? 80;
    return $limits;
}
function deliveryStatus(): array
{
    $queues = [];
    foreach (
        ["sms" => "notification_outbox", "email" => "email_outbox"]
        as $channel => $table
    ) {
        $row = one(
            "SELECT COUNT(*) total,MIN(created_at) oldest FROM $table WHERE status IN ('pending','retry','blocked')",
        );
        $queues[$channel] = [
            "waiting" => (int) $row["total"],
            "oldest_at" => $row["oldest"],
            "oldest_age_seconds" => $row["oldest"]
                ? max(0, time() - strtotime($row["oldest"]))
                : 0,
        ];
        $queues[$channel]["states"] = rows(
            "SELECT status,COUNT(*) n FROM $table GROUP BY status",
        );
    }
    $limits = deliveryLimits();
    return [
        "limits" => $limits,
        "mail_daily_limit" => emailConfig()["daily_limit"],
        "queues" => $queues,
        "sms_estimated_minutes" => integrationEnabled("sms")
            ? (int) ceil($queues["sms"]["waiting"] / $limits["sms_per_minute"])
            : null,
        "worker_last_run" => setting("worker_last_run"),
        "email_worker_last_run" => setting("email_worker_last_run"),
    ];
}
function deliveryAction(string $action, string $method, array $data): ?array
{
    if (!in_array($action, ["delivery.status", "delivery.configure"], true)) {
        return null;
    }
    if ($method !== ($action === "delivery.status" ? "GET" : "POST")) {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    if ($method === "POST") {
        csrf();
    }
    $user = auth(["admin"]);
    staffMfaGuard($user, $action);
    if ($action === "delivery.status") {
        return deliveryStatus();
    }
    rate("delivery-config:" . $user["id"], 5, 900);
    $account = one("SELECT password FROM users WHERE id=?", [$user["id"]]);
    if (
        !password_verify(
            (string) ($data["current_password"] ?? ""),
            $account["password"],
        )
    ) {
        fail(422, "كلمة مرور الإدارة غير صحيحة.");
    }
    if (($data["limits_confirmed"] ?? false) !== true) {
        fail(422, "راجع حدود حسابات المزودين وأكد مطابقة الإعداد لها.");
    }
    $plan = $data["mail_plan"] ?? "free";
    if (!in_array($plan, ["free", "starter", "standard", "premium"], true)) {
        fail(422, "اختر خطة بريد صحيحة.");
    }
    $dailyMax = [
        "free" => 80,
        "starter" => 900,
        "standard" => 2700,
        "premium" => 2700,
    ][$plan];
    $daily = number(
        $data["mail_daily_limit"] ?? emailConfig()["daily_limit"],
        1,
        $dailyMax,
    );
    $limits = [
        "mail_plan" => $plan,
        "mail_per_minute" => number($data["mail_per_minute"] ?? 5, 1, 60),
        "mail_reserved_percent" => number(
            $data["mail_reserved_percent"] ?? 25,
            10,
            80,
        ),
        "sms_per_minute" => number($data["sms_per_minute"] ?? 200, 1, 6000),
        "sms_parallel" => number($data["sms_parallel"] ?? 4, 1, 8),
    ];
    tx(function () use ($limits, $daily, $user) {
        lockRow("storage_locks", "email");
        lockRow("storage_locks", "sms");
        setSetting("delivery_limits", $limits);
        $email = emailConfig();
        $email["daily_limit"] = $daily;
        setSetting(
            "email_connection",
            enc(
                json_encode(
                    $email,
                    JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
                ),
            ),
        );
        audit($user, "delivery.limits_saved");
    });
    return deliveryStatus();
}
