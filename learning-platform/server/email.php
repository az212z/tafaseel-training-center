<?php
declare(strict_types=1);

function emailConfig(): array
{
    $stored = setting("email_connection", "");
    $saved = $stored
        ? json_decode(dec($stored), true, 16, JSON_THROW_ON_ERROR)
        : [];
    return $saved + [
        "enabled" => false,
        "host" => "smtp.hostinger.com",
        "port" => 465,
        "address" => "admin@tafaseel-learn.com",
        "password" => "",
        "name" => "مركز تفاصيل للتدريب",
        "daily_limit" => 80,
    ];
}
function emailReady(): bool
{
    $c = emailConfig();
    return $c["enabled"] && $c["password"] !== "";
}
function emailPreference(string $id): array
{
    $p = one("SELECT * FROM email_preferences WHERE user_id=?", [$id]);
    return [
        "training_enabled" => (bool) ($p["training_enabled"] ?? true),
        "marketing_enabled" => (bool) ($p["marketing_enabled"] ?? false),
    ];
}
function saveEmailPreference(string $id, bool $training, bool $marketing): void
{
    if (one("SELECT user_id FROM email_preferences WHERE user_id=?", [$id])) {
        run(
            "UPDATE email_preferences SET training_enabled=?,marketing_enabled=?,updated_at=? WHERE user_id=?",
            [(int) $training, (int) $marketing, now(), $id],
        );
    } else {
        run(
            "INSERT INTO email_preferences(user_id,training_enabled,marketing_enabled,updated_at) VALUES(?,?,?,?)",
            [$id, (int) $training, (int) $marketing, now()],
        );
    }
    run(
        "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE user_id=? AND status IN ('pending','retry','blocked') AND (kind='marketing' OR kind IN ('training','class_reminder','announcement')) AND (kind='marketing' AND ?=0 OR kind<>'marketing' AND ?=0)",
        [now(), $id, (int) $marketing, (int) $training],
    );
}
function emailUnsubscribeToken(string $id): string
{
    return $id .
        "." .
        hash_hmac("sha256", "email-unsubscribe:" . $id, cfg()["key"]);
}
function emailUnsubscribeUser(string $token): ?string
{
    $id = explode(".", $token)[0];
    if (
        !preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $id) ||
        !hash_equals(emailUnsubscribeToken($id), $token)
    ) {
        return null;
    }
    return one("SELECT id FROM users WHERE id=?", [$id]) ? $id : null;
}
function queueEmail(
    string $key,
    string $user,
    string $kind,
    string $subject,
    string $body,
    string $path = "/dashboard",
    ?string $course = null,
    ?string $resource = null,
    ?string $campaign = null,
    ?string $due = null,
): void {
    $u = one("SELECT id,email,active FROM users WHERE id=?", [$user]);
    if (!$u || !filter_var($u["email"], FILTER_VALIDATE_EMAIL)) {
        return;
    }
    $p = emailPreference($user);
    if ($kind === "marketing" && !$p["marketing_enabled"]) {
        return;
    }
    if (
        in_array($kind, ["training", "class_reminder", "announcement"], true) &&
        !$p["training_enabled"]
    ) {
        return;
    }
    if (one("SELECT id FROM email_outbox WHERE dedupe_key=?", [$key])) {
        return;
    }
    run(
        "INSERT INTO email_outbox(id,dedupe_key,user_id,campaign_id,course_id,resource_id,kind,recipient,subject,body,link_path,status,next_attempt_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            uid(),
            $key,
            $user,
            $campaign,
            $course,
            $resource,
            $kind,
            enc($u["email"]),
            enc($subject),
            enc($body),
            $kind === "invitation" ? enc($path) : $path,
            emailReady() ? "pending" : "blocked",
            $due ?? now(),
            now(),
            now(),
        ],
    );
}
function emailAdmins(
    string $key,
    string $subject,
    string $body,
    string $path,
): void {
    foreach (
        rows("SELECT id FROM users WHERE role='admin' AND active=1")
        as $admin
    ) {
        // The center mailbox receives administrative alerts; the login address stays independent.
        queueEmail(
            $key . ":" . $admin["id"],
            $admin["id"],
            "admin_alert",
            $subject,
            $body,
            $path,
        );
    }
}
function emailEnrollment(string $course, string $student): void
{
    $c = one("SELECT title FROM courses WHERE id=?", [$course]);
    queueEmail(
        "enrolled:" . $course . ":" . $student,
        $student,
        "training",
        "أضيفت دورة إلى حسابك في تفاصيل",
        "أصبحت مسجلًا في دورة «" .
            $c["title"] .
            "». افتح الدورة لمتابعة دروسك ومواعيد التدريب. هذه رسالة تسجيل، وليست فاتورة سداد.",
        "/courses/" . $course,
        $course,
    );
}
function emailQueueCourse(
    string $course,
    string $key,
    string $kind,
    string $subject,
    string $body,
    string $path,
): int {
    $users = rows(
        "SELECT u.id FROM users u JOIN enrollments e ON e.student_id=u.id JOIN courses c ON c.id=e.course_id WHERE e.course_id=? AND u.active=1 AND c.status='published'",
        [$course],
    );
    foreach ($users as $u) {
        queueEmail(
            $key . ":" . $u["id"],
            $u["id"],
            $kind,
            $subject,
            $body,
            $path,
            $course,
        );
    }
    return count($users);
}
function scheduleClassEmails(): void
{
    if (!emailReady()) {
        return;
    }
    $until = gmdate("Y-m-d\TH:i:s\Z", time() + 3600);
    foreach (
        rows(
            "SELECT k.id,k.course_id,k.title,k.starts_at,c.title course_title FROM classes k JOIN courses c ON c.id=k.course_id WHERE k.starts_at>? AND k.starts_at<=? AND c.status='published' ORDER BY k.starts_at LIMIT 100",
            [now(), $until],
        )
        as $k
    ) {
        $time = (new DateTimeImmutable($k["starts_at"]))
            ->setTimezone(new DateTimeZone("Asia/Riyadh"))
            ->format("Y-m-d H:i");
        foreach (
            rows("SELECT student_id FROM enrollments WHERE course_id=?", [
                $k["course_id"],
            ])
            as $e
        ) {
            queueEmail(
                "class-reminder:" . $k["id"] . ":" . $e["student_id"],
                $e["student_id"],
                "class_reminder",
                "تذكير بموعدك التدريبي في تفاصيل",
                $k["title"] .
                    "\nالدورة: " .
                    $k["course_title"] .
                    "\nالموعد بتوقيت السعودية: " .
                    $time .
                    "\nادخل إلى جدولك للاطلاع على تفاصيل اللقاء ورابط البث المباشر.",
                "/schedule",
                $k["course_id"],
                $k["id"],
            );
        }
    }
}
function emailTemplate(
    string $subject,
    string $body,
    string $path,
    string $user,
    bool $invitation = false,
): array {
    $escape = fn($s) => htmlspecialchars(
        $s,
        ENT_QUOTES | ENT_SUBSTITUTE,
        "UTF-8",
    );
    if (
        !preg_match('#^/[a-zA-Z0-9/_-]*$#', $path) &&
        !(
            $invitation &&
            preg_match('/^\/activate#[a-f0-9]{32}\.[a-f0-9]{64}$/', $path)
        )
    ) {
        $path = "/dashboard";
    }
    $url = rtrim(cfg()["origin"], "/") . $path;
    $unsubscribe =
        rtrim(cfg()["origin"], "/") .
        "/mail/?token=" .
        rawurlencode(emailUnsubscribeToken($user));
    $footer = $invitation
        ? "هذه رسالة خاصة بإكمال التسجيل. لا تشارك رابط الدعوة أو كلمة مرورك مع أي شخص."
        : "يمكنك إدارة تفضيلات الرسائل من حسابك، أو إيقاف التنبيهات الاختيارية من الرابط التالي.";
    $html =
        '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' .
        $escape($subject) .
        '</title></head><body style="margin:0;background:#f2f5f7;color:#173d43;font-family:Tahoma,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="padding:24px 28px;background:#144d50;color:#fff;border-radius:16px 16px 0 0"><strong style="font-size:28px">تفاصيل</strong><div style="font-size:13px;margin-top:8px">مساحتك للتعلّم والتطوّر</div></td></tr><tr><td style="padding:28px;text-align:right"><h1 style="font-size:22px;line-height:1.6;margin:0 0 18px">' .
        $escape($subject) .
        '</h1><div style="font-size:16px;line-height:1.9;color:#344d51">' .
        nl2br($escape($body)) .
        '</div><p style="margin:28px 0"><a href="' .
        $escape($url) .
        '" style="display:inline-block;padding:13px 24px;background:#144d50;color:#fff;border-radius:8px;text-decoration:none">فتح منصة تفاصيل</a></p><p style="font-size:13px;line-height:1.8;color:#607478">للرد والاستفسارات: <a href="mailto:' .
        $escape(emailConfig()["address"]) .
        '">' .
        $escape(emailConfig()["address"]) .
        '</a></p></td></tr><tr><td style="padding:20px 28px;border-top:1px solid #e6eeef;font-size:12px;line-height:1.8;color:#607478">مركز تفاصيل للتدريب<br>' .
        $footer .
        '<br><a href="' .
        $escape($unsubscribe) .
        '">إدارة اشتراك البريد</a></td></tr></table></td></tr></table></body></html>';
    if ($invitation) {
        $html = str_replace(
            "فتح منصة تفاصيل</a>",
            "توثيق الحساب وإكمال التسجيل</a>",
            $html,
        );
        $html = str_replace(
            '<br><a href="' .
                $escape($unsubscribe) .
                '">إدارة اشتراك البريد</a>',
            "",
            $html,
        );
    }
    return [
        "html" => $html,
        "text" =>
            $subject .
            "\n\n" .
            $body .
            "\n\nمنصة تفاصيل: " .
            $url .
            "\n\n" .
            $footer .
            "\n" .
            ($invitation ? "" : $unsubscribe),
        "unsubscribe" => $unsubscribe,
    ];
}
function sendEmailSmtp(array $n): void
{
    require_once is_file(__DIR__ . "/vendor/autoload.php")
        ? __DIR__ . "/vendor/autoload.php"
        : __DIR__ . "/../vendor/autoload.php";
    $c = emailConfig();
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $smtp = new class extends PHPMailer\PHPMailer\SMTP {
        public int $lastFailureCode = 0;
        public bool $dataAttempted = false;
        protected function setError(
            $message,
            $detail = "",
            $smtp_code = "",
            $smtp_code_ex = "",
        ) {
            if ((int) $smtp_code >= 400) {
                $this->lastFailureCode = (int) $smtp_code;
            }
            parent::setError($message, $detail, $smtp_code, $smtp_code_ex);
        }
        public function data($msg_data)
        {
            $this->dataAttempted = true;
            return parent::data($msg_data);
        }
    };
    $smtp->Timelimit = 20;
    $mail->setSMTPInstance($smtp);
    $mail->isSMTP();
    $mail->Host = $c["host"];
    $mail->Port = (int) $c["port"];
    $mail->SMTPAuth = true;
    $mail->Username = $c["address"];
    $mail->Password = $c["password"];
    $mail->SMTPSecure = (int) $c["port"] === 465 ? "ssl" : "tls";
    $mail->Timeout = 12;
    $mail->CharSet = "UTF-8";
    $mail->SMTPDebug = 0;
    // Tests must never fall back to the real relay when their receiver is missing.
    if (
        (cfg()["testing"] ?? false) &&
        (cfg()["environment"] !== "local" || empty(cfg()["test_smtp_port"]))
    ) {
        throw new ProviderError("smtp_test_not_configured", false);
    }
    // Local protocol tests are limited to an explicit disposable environment.
    if (
        cfg()["environment"] === "local" &&
        (cfg()["testing"] ?? false) &&
        isset(cfg()["test_smtp_port"])
    ) {
        $mail->Host = "127.0.0.1";
        $mail->Port = (int) cfg()["test_smtp_port"];
        $mail->SMTPSecure = "";
        $mail->SMTPAutoTLS = false;
    }
    $mail->setFrom($c["address"], $c["name"]);
    $mail->addReplyTo($c["address"], $c["name"]);
    $mail->addAddress($n["recipient"]);
    $mail->Subject = $n["subject"];
    $content = emailTemplate(
        $n["subject"],
        $n["body"],
        $n["link_path"],
        $n["user_id"],
        $n["kind"] === "invitation",
    );
    $mail->isHTML(true);
    $mail->Body = $content["html"];
    $mail->AltBody = $content["text"];
    $mail->MessageID =
        "<" . $n["id"] . "@" . explode("@", $c["address"])[1] . ">";
    if (
        in_array(
            $n["kind"],
            ["marketing", "training", "announcement", "class_reminder"],
            true,
        )
    ) {
        $mail->addCustomHeader(
            "List-Unsubscribe",
            "<" . $content["unsubscribe"] . ">",
        );
        $mail->addCustomHeader(
            "List-Unsubscribe-Post",
            "List-Unsubscribe=One-Click",
        );
    }
    try {
        $mail->send();
    } catch (PHPMailer\PHPMailer\Exception $e) {
        $code = $smtp->lastFailureCode;
        // A lost final DATA acknowledgement must not trigger an automatic duplicate.
        $uncertain = !$code && $smtp->dataAttempted;
        throw new ProviderError(
            $code ? "smtp_" . $code : "smtp_connection",
            $uncertain,
        );
    }
}
function emailStillAllowed(array $n, array $u): bool
{
    if ($n["kind"] === "invitation") {
        $invite = one(
            "SELECT * FROM account_invitations WHERE id=? AND user_id=?",
            [$n["resource_id"], $u["id"]],
        );
        return $invite && invitationUsable($invite, $u);
    }
    if (!$u["active"] && $n["kind"] !== "registration") {
        return false;
    }
    if ($n["campaign_id"]) {
        $campaign = one("SELECT status FROM email_campaigns WHERE id=?", [
            $n["campaign_id"],
        ]);
        if (!$campaign || $campaign["status"] !== "queued") {
            return false;
        }
    }
    $p = emailPreference($u["id"]);
    if ($n["kind"] === "marketing" && !$p["marketing_enabled"]) {
        return false;
    }
    if (
        in_array(
            $n["kind"],
            ["training", "class_reminder", "announcement"],
            true,
        ) &&
        !$p["training_enabled"]
    ) {
        return false;
    }
    if (
        $n["course_id"] &&
        !one(
            "SELECT e.id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND e.course_id=? AND c.status='published'",
            [$u["id"], $n["course_id"]],
        )
    ) {
        return false;
    }
    if ($n["kind"] === "class_reminder") {
        $k = one("SELECT starts_at FROM classes WHERE id=?", [
            $n["resource_id"],
        ]);
        if (!$k || $k["starts_at"] <= now()) {
            return false;
        }
    }
    return true;
}
function dispatchEmails(int $limit = 5): array
{
    setSetting("email_worker_last_run", now());
    tx(function () {
        lockRow("storage_locks", "email");
        scheduleClassEmails();
    });
    $result = [
        "accepted" => 0,
        "failed" => 0,
        "uncertain" => 0,
        "cancelled" => 0,
        "blocked" => 0,
        "retry" => 0,
        "deferred" => 0,
    ];
    run(
        "UPDATE email_outbox SET status='uncertain',error_code='worker_lease_expired',updated_at=? WHERE status='sending' AND locked_until<?",
        [now(), now()],
    );
    foreach (
        rows(
            "SELECT id FROM email_outbox WHERE status IN ('pending','retry','blocked') AND next_attempt_at<=? ORDER BY CASE WHEN kind='marketing' THEN 1 ELSE 0 END,next_attempt_at,id LIMIT " .
                max(1, min(10, $limit)),
            [now()],
        )
        as $entry
    ) {
        $claim = tx(function () use ($entry) {
            lockRow("storage_locks", "email");
            lockRow("email_outbox", $entry["id"]);
            $n = one("SELECT * FROM email_outbox WHERE id=?", [$entry["id"]]);
            if (
                !in_array(
                    $n["status"],
                    ["pending", "retry", "blocked"],
                    true,
                ) ||
                $n["next_attempt_at"] > now()
            ) {
                return null;
            }
            $u = one("SELECT * FROM users WHERE id=?", [$n["user_id"]]);
            if (!$u || !emailStillAllowed($n, $u)) {
                run(
                    "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE id=?",
                    [now(), $n["id"]],
                );
                return ["state" => "cancelled"];
            }
            if (!emailReady()) {
                run(
                    "UPDATE email_outbox SET status='blocked',error_code='smtp_not_configured',next_attempt_at=?,updated_at=? WHERE id=?",
                    [gmdate("Y-m-d\TH:i:s\Z", time() + 300), now(), $n["id"]],
                );
                return ["state" => "blocked"];
            }
            $day = gmdate("Y-m-d\TH:i:s\Z", time() - 86400);
            $minute = gmdate("Y-m-d\TH:i:s\Z", time() - 60);
            if (
                (int) one(
                    "SELECT COUNT(*) n FROM email_attempts WHERE created_at>?",
                    [$day],
                )["n"] >= (int) emailConfig()["daily_limit"] ||
                (int) one(
                    "SELECT COUNT(*) n FROM email_attempts WHERE created_at>?",
                    [$minute],
                )["n"] >= 5
            ) {
                return ["state" => "deferred"];
            }
            $token = uid();
            run(
                "INSERT INTO email_attempts(id,message_id,created_at) VALUES(?,?,?)",
                [uid(), $n["id"], now()],
            );
            $recipient =
                $n["kind"] === "admin_alert" || $n["kind"] === "test"
                    ? emailConfig()["address"]
                    : $u["email"];
            run(
                "UPDATE email_outbox SET status='sending',recipient=?,attempts=attempts+1,lock_token=?,locked_until=?,updated_at=? WHERE id=?",
                [
                    enc($recipient),
                    $token,
                    gmdate("Y-m-d\TH:i:s\Z", time() + 120),
                    now(),
                    $n["id"],
                ],
            );
            $n["recipient"] = $recipient;
            $n["subject"] = dec($n["subject"]);
            $n["body"] = dec($n["body"]);
            if ($n["kind"] === "invitation") {
                $n["link_path"] = dec($n["link_path"]);
            }
            $n["lock_token"] = $token;
            return $n;
        });
        if (!$claim) {
            continue;
        }
        if (isset($claim["state"])) {
            $result[$claim["state"]]++;
            continue;
        }
        try {
            sendEmailSmtp($claim);
            run(
                "UPDATE email_outbox SET status='accepted',message_id=?,error_code=NULL,locked_until=NULL,lock_token=NULL,updated_at=? WHERE id=? AND lock_token=?",
                [
                    "<" .
                    $claim["id"] .
                    "@" .
                    explode("@", emailConfig()["address"])[1] .
                    ">",
                    now(),
                    $claim["id"],
                    $claim["lock_token"],
                ],
            );
            setSetting("email_last_accept", now());
            audit(null, "email.accepted", $claim["id"]);
            $result["accepted"]++;
        } catch (ProviderError $e) {
            $temporary =
                preg_match('/^smtp_4[0-9]{2}$/', $e->reason) ||
                $e->reason === "smtp_connection";
            $status = $e->uncertain
                ? "uncertain"
                : ($temporary && (int) $claim["attempts"] < 3
                    ? "retry"
                    : "failed");
            run(
                "UPDATE email_outbox SET status=?,error_code=?,locked_until=NULL,lock_token=NULL,next_attempt_at=?,updated_at=? WHERE id=? AND lock_token=?",
                [
                    $status,
                    $e->reason,
                    gmdate(
                        "Y-m-d\TH:i:s\Z",
                        time() + 300 * (1 + (int) $claim["attempts"]),
                    ),
                    now(),
                    $claim["id"],
                    $claim["lock_token"],
                ],
            );
            $result[$status]++;
        } catch (Throwable $e) {
            run(
                "UPDATE email_outbox SET status='uncertain',error_code='transport_interrupted',locked_until=NULL,lock_token=NULL,updated_at=? WHERE id=? AND lock_token=?",
                [now(), $claim["id"], $claim["lock_token"]],
            );
            $result["uncertain"]++;
        }
    }
    return $result;
}

function emailCampaignInput(array $u, array $d): array
{
    $kind = str($d["kind"] ?? "training", 30);
    if (!in_array($kind, ["training", "marketing"], true)) {
        fail(422, "نوع الرسالة غير صالح.");
    }
    $course = str($d["course_id"] ?? "", 40, false);
    if ($kind === "training") {
        if (!$course) {
            fail(422, "اختر الدورة التي يخصها التنبيه التدريبي.");
        }
        courseAccess($u, $course, true);
        if (
            !one("SELECT id FROM courses WHERE id=? AND status='published'", [
                $course,
            ])
        ) {
            fail(422, "التنبيه التدريبي متاح للدورات المنشورة فقط.");
        }
        $recipients = rows(
            "SELECT u.id,u.name,u.email FROM users u JOIN enrollments e ON e.student_id=u.id LEFT JOIN email_preferences p ON p.user_id=u.id WHERE e.course_id=? AND u.active=1 AND COALESCE(p.training_enabled,1)=1 ORDER BY u.id LIMIT 10001",
            [$course],
        );
    } else {
        if ($u["role"] !== "admin") {
            fail(403, "النشرات العامة خاصة بالإدارة.");
        }
        $course = "";
        $recipients = rows(
            "SELECT u.id,u.name,u.email FROM users u JOIN email_preferences p ON p.user_id=u.id WHERE u.active=1 AND p.marketing_enabled=1 ORDER BY u.id LIMIT 10001",
        );
    }
    if (count($recipients) > 10000) {
        fail(422, "قسّم النشرة إلى مجموعات أصغر من عشرة آلاف مستلم.");
    }
    $subject = str($d["subject"] ?? "", 160);
    $body = str($d["body"] ?? "", 5000);
    if (preg_match('/[\r\n]/', $subject)) {
        fail(422, "العنوان يجب أن يكون في سطر واحد.");
    }
    $fingerprint = hash(
        "sha256",
        json_encode(
            [$kind, $course, $subject, $body, $recipients],
            JSON_UNESCAPED_UNICODE,
        ),
    );
    return compact(
        "kind",
        "course",
        "subject",
        "body",
        "recipients",
        "fingerprint",
    );
}
function emailAction(string $action, string $method, array $d): ?array
{
    $gets = [
        "email.status",
        "email.log",
        "email.campaigns",
        "email.preference",
    ];
    $posts = [
        "email.configure",
        "email.test",
        "email.dispatch",
        "email.campaign.preview",
        "email.campaign.send",
        "email.campaign.cancel",
        "email.preference.save",
    ];
    if (!in_array($action, [...$gets, ...$posts], true)) {
        return null;
    }
    if ($method !== (in_array($action, $gets, true) ? "GET" : "POST")) {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    if ($method === "POST") {
        csrf();
    }
    $u = auth();
    if (staffNeedsMfa($u)) {
        fail(403, "أكمل إعداد أمان الحساب.");
    }
    if ($action === "email.preference") {
        return emailPreference($u["id"]);
    }
    if ($action === "email.preference.save") {
        tx(
            fn() => saveEmailPreference(
                $u["id"],
                ($d["training_enabled"] ?? false) === true,
                ($d["marketing_enabled"] ?? false) === true,
            ),
        );
        audit($u, "email.preference");
        return ["ok" => true];
    }
    if (
        $action === "email.campaign.preview" ||
        $action === "email.campaign.send"
    ) {
        if (!in_array($u["role"], ["admin", "instructor"], true)) {
            fail(403, "إرسال التنبيهات خاص بالإدارة والمدربين.");
        }
        $input = emailCampaignInput($u, $d);
        if ($action === "email.campaign.preview") {
            return [
                "recipients" => count($input["recipients"]),
                "sample" => array_slice(
                    array_column($input["recipients"], "name"),
                    0,
                    5,
                ),
                "fingerprint" => $input["fingerprint"],
                "sender" => emailConfig()["address"],
                "can_schedule" => emailReady(),
                ...$u["role"] === "admin" ? ["configured" => emailReady()] : [],
                "html" => emailTemplate(
                    $input["subject"],
                    $input["body"],
                    $input["course"]
                        ? "/courses/" . $input["course"]
                        : "/programs",
                    $u["id"],
                )["html"],
            ];
        }
        if (!emailReady()) {
            fail(
                422,
                $u["role"] === "admin"
                    ? "أكمل ربط البريد واختبار الإرسال أولًا."
                    : "الإرسال غير متاح حاليًا. تواصل مع الإدارة.",
            );
        }
        if (
            !hash_equals(
                $input["fingerprint"],
                (string) ($d["fingerprint"] ?? ""),
            )
        ) {
            fail(409, "تغيّر المحتوى أو المستلمون. أعد معاينة الرسالة.");
        }
        if (!$input["recipients"]) {
            fail(422, "لا يوجد مستلمون مطابقون لتفضيلات الاشتراك.");
        }
        $id = str($d["id"] ?? "", 40);
        if (!preg_match('/^[a-f0-9]{32}$/', $id)) {
            fail(422, "معرّف الإرسال غير صالح.");
        }
        return tx(function () use ($input, $id, $u) {
            lockRow("storage_locks", "email");
            $exists = one(
                "SELECT author_id,recipients FROM email_campaigns WHERE id=?",
                [$id],
            );
            if ($exists) {
                if ($exists["author_id"] !== $u["id"]) {
                    fail(403, "النشرة تخص حسابًا آخر.");
                }
                return [
                    "id" => $id,
                    "queued" => (int) $exists["recipients"],
                    "existing" => true,
                ];
            }
            run(
                "INSERT INTO email_campaigns(id,course_id,kind,subject,body,status,author_id,recipients,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                [
                    $id,
                    $input["course"] ?: null,
                    $input["kind"],
                    $input["subject"],
                    enc($input["body"]),
                    "queued",
                    $u["id"],
                    count($input["recipients"]),
                    now(),
                ],
            );
            foreach ($input["recipients"] as $r) {
                queueEmail(
                    "campaign:" . $id . ":" . $r["id"],
                    $r["id"],
                    $input["kind"],
                    $input["subject"],
                    $input["body"],
                    $input["course"]
                        ? "/courses/" . $input["course"]
                        : "/programs",
                    $input["course"] ?: null,
                    null,
                    $id,
                );
            }
            audit($u, "email.campaign.queued", $id);
            return ["id" => $id, "queued" => count($input["recipients"])];
        });
    }
    if ($action === "email.campaigns") {
        if (!in_array($u["role"], ["admin", "instructor"], true)) {
            fail(403, "السجل خاص بالإدارة والمدربين.");
        }
        $page = number($d["page"] ?? 1, 1, 1000000);
        $where = $u["role"] === "admin" ? "1=1" : "c.author_id=?";
        $args = $u["role"] === "admin" ? [] : [$u["id"]];
        $deliveryCounts =
            $u["role"] === "admin"
                ? ",(SELECT COUNT(*) FROM email_outbox o WHERE o.campaign_id=c.id AND o.status='accepted') accepted,(SELECT COUNT(*) FROM email_outbox o WHERE o.campaign_id=c.id AND o.status IN ('failed','uncertain')) needs_review"
                : "";
        return pagedList(
            "SELECT c.id,c.subject,c.kind,c.course_id,c.status,c.recipients,c.created_at" .
                $deliveryCounts .
                " FROM email_campaigns c WHERE " .
                $where .
                " ORDER BY c.created_at DESC,c.id",
            "SELECT COUNT(*) n FROM email_campaigns c WHERE " . $where,
            $args,
            $page,
        );
    }
    if ($action === "email.campaign.cancel") {
        if (!in_array($u["role"], ["admin", "instructor"], true)) {
            fail(403, "الصلاحية غير كافية.");
        }
        $id = str($d["id"] ?? "", 40);
        $c = one("SELECT * FROM email_campaigns WHERE id=?", [$id]);
        if (!$c) {
            fail(404, "النشرة غير موجودة.");
        }
        if ($u["role"] !== "admin" && $c["author_id"] !== $u["id"]) {
            fail(403, "النشرة تخص حسابًا آخر.");
        }
        tx(function () use ($id) {
            lockRow("storage_locks", "email");
            run("UPDATE email_campaigns SET status='cancelled' WHERE id=?", [
                $id,
            ]);
            run(
                "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE campaign_id=? AND status IN ('pending','blocked','retry')",
                [now(), $id],
            );
        });
        audit($u, "email.campaign.cancelled", $id);
        return ["ok" => true];
    }
    if ($u["role"] !== "admin") {
        fail(403, "إعداد البريد وسجل الإرسال خاصان بالإدارة.");
    }
    if ($action === "email.status") {
        $c = emailConfig();
        unset($c["password"]);
        $c["configured"] = emailReady();
        $c["has_password"] = emailConfig()["password"] !== "";
        $c["worker_last_run"] = setting("email_worker_last_run");
        $c["last_accept"] = setting("email_last_accept");
        $c["used_24h"] = (int) one(
            "SELECT COUNT(*) n FROM email_attempts WHERE created_at>?",
            [gmdate("Y-m-d\TH:i:s\Z", time() - 86400)],
        )["n"];
        $c["counts"] = rows(
            "SELECT status,COUNT(*) n FROM email_outbox GROUP BY status",
        );
        return $c;
    }
    if ($action === "email.configure") {
        rate("email-config:" . $u["id"], 10, 900);
        $owner = one("SELECT password FROM users WHERE id=?", [$u["id"]]);
        if (
            !password_verify((string) ($d["current"] ?? ""), $owner["password"])
        ) {
            fail(422, "كلمة مرور حساب الإدارة الحالية غير صحيحة.");
        }
        $c = emailConfig();
        $address = email($d["address"] ?? $c["address"]);
        if (strtolower(explode("@", $address)[1]) !== "tafaseel-learn.com") {
            fail(422, "استخدم بريد المركز على tafaseel-learn.com.");
        }
        $password = (string) ($d["password"] ?? "");
        if (strlen($password) > 256 || preg_match('/[\r\n\x00]/', $password)) {
            fail(422, "كلمة مرور البريد غير صالحة.");
        }
        if ($address !== $c["address"] && !$password) {
            fail(422, "عند تغيير البريد أدخل كلمة مرور البريد الجديد.");
        }
        $port = number($d["port"] ?? 465, 465, 587);
        if (!in_array($port, [465, 587], true)) {
            fail(422, "استخدم المنفذ 465 أو 587.");
        }
        $c = [
            "enabled" => ($d["enabled"] ?? false) === true,
            "host" => "smtp.hostinger.com",
            "port" => $port,
            "address" => $address,
            "name" => str($d["name"] ?? "مركز تفاصيل للتدريب", 100),
            "password" => $password ?: $c["password"],
            "daily_limit" => number($d["daily_limit"] ?? 80, 1, 80),
        ];
        if ($c["enabled"] && !$c["password"]) {
            fail(422, "أدخل كلمة مرور البريد لإتمام الربط.");
        }
        setSetting(
            "email_connection",
            enc(json_encode($c, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)),
        );
        if ($c["enabled"]) {
            run(
                "UPDATE email_outbox SET next_attempt_at=? WHERE status='blocked'",
                [now()],
            );
        }
        audit($u, "email.configured");
        return ["ok" => true, "configured" => emailReady()];
    }
    if ($action === "email.test") {
        rate("email-test:" . $u["id"], 3, 900);
        if (!emailReady()) {
            fail(422, "أكمل ربط البريد أولًا.");
        }
        $id = uid();
        queueEmail(
            "test:" . $id,
            $u["id"],
            "test",
            "تم ربط البريد الرسمي بمنصة تفاصيل",
            "هذه رسالة اختبار لربط البريد الرسمي. أصبحت المنصة جاهزة لإرسال تنبيهات التدريب واللقاءات والدعم وفق إعدادات المركز. لا تحتوي الرسالة على بيانات دخول.",
            "/communications",
        );
        $result = dispatchEmails(5);
        return [
            "ok" => true,
            "dispatch" => $result,
            "message" =>
                "راجع السجل وصندوق البريد للتحقق من وصول رسالة الاختبار.",
        ];
    }
    if ($action === "email.dispatch") {
        rate("email-dispatch", 5, 60);
        return dispatchEmails(5);
    }
    $page = number($d["page"] ?? 1, 1, 1000000);
    $result = pagedList(
        "SELECT id,kind,status,attempts,error_code,recipient,subject,created_at,updated_at FROM email_outbox ORDER BY created_at DESC,id",
        "SELECT COUNT(*) n FROM email_outbox",
        [],
        $page,
    );
    foreach ($result["items"] as &$row) {
        $em = dec($row["recipient"]);
        $parts = explode("@", $em);
        $row["recipient"] =
            substr($parts[0], 0, 1) . "•••@" . ($parts[1] ?? "");
        $row["subject"] = dec($row["subject"]);
    }
    return $result;
}
