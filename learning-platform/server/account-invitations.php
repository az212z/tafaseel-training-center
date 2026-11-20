<?php
declare(strict_types=1);

function invitationUsable(array $invite, array $user): bool
{
    return !$invite["used_at"] &&
        !$invite["revoked_at"] &&
        $invite["expires_at"] > now() &&
        !$user["active"] &&
        (int) $invite["auth_version"] === (int) $user["auth_version"] &&
        hash_equals(
            $invite["email_hash"],
            hash("sha256", strtolower($user["email"])),
        );
}

// Called within the account transaction. A resend replaces the previous bearer token.
function issueAccountInvitation(
    string $userId,
    array $admin,
    ?string $inquiry = null,
    bool $registration = false,
): void {
    lockRow("users", $userId);
    $user = one("SELECT * FROM users WHERE id=?", [$userId]);
    $old = one("SELECT * FROM account_invitations WHERE user_id=?", [$userId]);
    if (!$user || $user["active"] || ($old && $old["used_at"])) {
        fail(409, "الدعوة متاحة للحسابات التي تنتظر التوثيق فقط.");
    }
    $inquiry = $inquiry ?? ($old["source_inquiry_id"] ?? null);
    $id = uid();
    $token = $id . "." . bin2hex(random_bytes(32));
    $values = [
        $id,
        hash("sha256", $token),
        hash("sha256", strtolower($user["email"])),
        $user["auth_version"],
        gmdate("Y-m-d\TH:i:s\Z", time() + 72 * 3600),
        $admin["id"],
        now(),
        $inquiry ?? ($old["source_inquiry_id"] ?? null),
    ];
    if ($old) {
        run(
            "UPDATE account_invitations SET id=?,token_hash=?,email_hash=?,auth_version=?,expires_at=?,used_at=NULL,revoked_at=NULL,created_by=?,created_at=?,source_inquiry_id=? WHERE user_id=?",
            [...$values, $userId],
        );
    } else {
        run(
            "INSERT INTO account_invitations(id,token_hash,email_hash,auth_version,expires_at,created_by,created_at,source_inquiry_id,user_id) VALUES(?,?,?,?,?,?,?,?,?)",
            [...$values, $userId],
        );
    }
    run(
        "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE user_id=? AND kind='invitation' AND status IN ('pending','blocked','retry')",
        [now(), $userId],
    );
    $teacher = $user["role"] === "instructor";
    $management = $user["role"] === "admin";
    $subject =
        $teacher && $inquiry
            ? "الموافقة على انضمامكم إلى منصة تفاصيل التعليمية"
            : "دعوتكم لإكمال التسجيل في منصة تفاصيل التعليمية";
    $intro =
        $teacher && $inquiry
            ? "يسرّ مركز تفاصيل للتدريب إشعاركم بالموافقة على طلب انضمامكم إلى الكادر التعليمي في منصة تفاصيل التعليمية."
            : ($teacher
                ? "يسرّ مركز تفاصيل للتدريب دعوتكم للانضمام إلى الكادر التعليمي في منصة تفاصيل التعليمية."
                : "يسرّ مركز تفاصيل للتدريب دعوتكم لإكمال تسجيل حسابكم في منصة تفاصيل التعليمية.");
    $body = $management
        ? "مرحباً " .
            $user["name"] .
            "،
أرسل مركز تفاصيل دعوة لتفعيل حسابكم الإداري. افتحوا الرابط الشخصي خلال ٧٢ ساعة للتحقق من البريد وتعيين كلمة المرور."
        : "الأستاذ/ة " .
            $user["name"] .
            " المحترم/ة،\nالسلام عليكم ورحمة الله وبركاته،\n\n" .
            $intro .
            "\n\nلاستكمال التسجيل وتوثيق بريدكم الإلكتروني، يرجى الضغط على «توثيق الحساب وإكمال التسجيل» أدناه، ثم تعيين كلمة مرور خاصة بكم." .
            "\nبعد إتمام التوثيق، يمكنكم تسجيل الدخول إلى مساحتكم " .
            ($teacher
                ? "التعليمية والاطلاع على الدورات التي تسندها إليكم الإدارة."
                : "التدريبية ومتابعة دوراتكم ومواعيدكم وإنجازاتكم.") .
            "\n\nحرصًا على خصوصيتكم، رابط الدعوة شخصي، وصالح لمدة ٧٢ ساعة، ويُستخدم مرة واحدة. إذا انتهت صلاحيته، يرجى التواصل مع إدارة المركز لطلب رابط جديد." .
            "\n\nنرحب بانضمامكم، ونتطلع إلى رحلة تعليمية مثمرة.\nوتفضلوا بقبول خالص التقدير،\nإدارة مركز تفاصيل للتدريب";
    if ($registration) {
        $subject = "تأكيد بريدك في تفاصيل";
        $body =
            "مرحبًا " .
            $user["name"] .
            "،
لتفعيل حسابك ومتابعة التسجيل في الدورة، افتح الرابط ثم اضغط «تأكيد البريد والمتابعة».";
        audit($user, "registration.email_requested", $userId);
    }
    queueEmail(
        "invitation:" . $id,
        $userId,
        "invitation",
        $management ? "دعوة تفعيل حساب إدارة تفاصيل" : $subject,
        $body,
        "/activate#" . $token,
        null,
        $id,
    );
    audit(
        $admin,
        $old ? "account.invitation_resent" : "account.invited",
        $userId,
    );
}

function accountInvitationLookup(string $token): ?array
{
    if (!preg_match('/^([a-f0-9]{32})\.[a-f0-9]{64}$/', $token, $match)) {
        return null;
    }
    $invite = one("SELECT * FROM account_invitations WHERE id=?", [$match[1]]);
    if (
        !$invite ||
        !hash_equals($invite["token_hash"], hash("sha256", $token))
    ) {
        return null;
    }
    $user = one("SELECT * FROM users WHERE id=?", [$invite["user_id"]]);
    return $user && invitationUsable($invite, $user)
        ? ["invite" => $invite, "user" => $user]
        : null;
}

function approveTrainerInquiry(string $id, array $data, array $admin): array
{
    return tx(function () use ($id, $data, $admin) {
        lockRow("website_inquiries", $id);
        $inquiry = one("SELECT * FROM website_inquiries WHERE id=?", [$id]);
        if (!$inquiry || $inquiry["kind"] !== "trainer") {
            fail(422, "اختر طلب انضمام معلم.");
        }
        $previous = one(
            "SELECT user_id FROM account_invitations WHERE source_inquiry_id=?",
            [$id],
        );
        if ($previous) {
            return [
                "ok" => true,
                "existing" => true,
                "user_id" => $previous["user_id"],
            ];
        }
        if (
            $inquiry["status"] === "closed" ||
            $inquiry["status"] === "approved"
        ) {
            fail(409, "راجع حالة الطلب قبل الموافقة.");
        }
        $details = json_decode(
            dec($inquiry["payload"]),
            true,
            32,
            JSON_THROW_ON_ERROR,
        );
        $email = email($data["email"] ?? ($details["email"] ?? ""));
        if (one("SELECT id FROM users WHERE email=?", [$email])) {
            fail(
                409,
                "البريد مرتبط بحساب قائم. راجع الحساب من صفحة الحسابات والصلاحيات.",
            );
        }
        $userId = uid();
        run(
            "INSERT INTO users(id,name,email,password,role,active,created_at) VALUES(?,?,?,?,?,?,?)",
            [
                $userId,
                str($details["name"], 120),
                $email,
                password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
                "instructor",
                0,
                now(),
            ],
        );
        $details["email"] = $email;
        run(
            "UPDATE website_inquiries SET status='approved',payload=?,updated_at=? WHERE id=?",
            [enc(json_encode($details, JSON_UNESCAPED_UNICODE)), now(), $id],
        );
        issueAccountInvitation($userId, $admin, $id);
        audit($admin, "teacher.approved", $id);
        return [
            "ok" => true,
            "invitation_queued" => true,
            "user_id" => $userId,
        ];
    });
}

function accountInvitationAction(
    string $action,
    string $method,
    array $data,
): ?array {
    if (
        !in_array(
            $action,
            [
                "account.invite.status",
                "account.invite.accept",
                "account.registration.verify",
                "account.invite.resend",
                "account.invite.revoke",
            ],
            true,
        )
    ) {
        return null;
    }
    if ($method !== "POST") {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    csrf();
    if (
        $action === "account.invite.resend" ||
        $action === "account.invite.revoke"
    ) {
        $admin = auth(["admin"]);
        staffMfaGuard($admin, $action);
        $id = str($data["id"] ?? "", 40);
        rate("invite-action:" . $action . ":" . $id, 5, 3600);
        return tx(function () use ($id, $admin, $action) {
            lockRow("users", $id);
            if (
                !one("SELECT id FROM account_invitations WHERE user_id=?", [
                    $id,
                ])
            ) {
                fail(404, "لا توجد دعوة لهذا الحساب.");
            }
            if ($action === "account.invite.revoke") {
                $invite = one(
                    "SELECT * FROM account_invitations WHERE user_id=?",
                    [$id],
                );
                if ($invite["used_at"]) {
                    fail(409, "الحساب موثّق. يمكنك إيقافه من إدارة الحسابات.");
                }
                run(
                    "UPDATE account_invitations SET revoked_at=? WHERE user_id=?",
                    [now(), $id],
                );
                run(
                    "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE user_id=? AND kind='invitation' AND status IN ('pending','blocked','retry')",
                    [now(), $id],
                );
                audit($admin, "account.invitation_revoked", $id);
                return ["ok" => true];
            }
            issueAccountInvitation($id, $admin);
            return ["ok" => true, "invitation_queued" => true];
        });
    }
    rate("invite-ip:" . ($_SERVER["REMOTE_ADDR"] ?? ""), 60, 900);
    $token = str($data["token"] ?? "", 110, false);
    $found = accountInvitationLookup($token);
    if (!$found) {
        fail(
            410,
            "رابط الدعوة غير صالح أو انتهت صلاحيته أو استُخدم سابقًا. تواصل مع الإدارة لطلب دعوة جديدة.",
        );
    }
    if ($action === "account.invite.status") {
        return [
            "name" => $found["user"]["name"],
            "role" => $found["user"]["role"],
            "registration" =>
                $found["user"]["role"] === "student" &&
                (bool) one(
                    "SELECT id FROM audit WHERE actor_id=? AND action='registration.email_requested' LIMIT 1",
                    [$found["user"]["id"]],
                ),
            "expires_at" => $found["invite"]["expires_at"],
        ];
    }
    if (currentUser()) {
        fail(409, "سجّل الخروج من الحساب الحالي قبل توثيق حساب آخر.");
    }
    $registration = $action === "account.registration.verify";
    if (
        $registration &&
        ($found["user"]["role"] !== "student" ||
            !one(
                "SELECT id FROM audit WHERE actor_id=? AND action='registration.email_requested' LIMIT 1",
                [$found["user"]["id"]],
            ))
    ) {
        fail(403, "هذه الدعوة تتطلب تعيين كلمة مرور صاحب الحساب.");
    }
    $hash = null;
    if (!$registration) {
        $password = pass($data["password"] ?? "");
        if (!hash_equals($password, (string) ($data["confirm"] ?? ""))) {
            fail(422, "كلمتا المرور غير متطابقتين.");
        }
        if (($data["consent"] ?? false) !== true) {
            fail(422, "الموافقة على الشروط وسياسة الخصوصية مطلوبة.");
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
    }
    $result = tx(function () use ($found, $token, $hash) {
        lockRow("users", $found["user"]["id"]);
        $fresh = accountInvitationLookup($token);
        if (!$fresh) {
            fail(410, "رابط الدعوة لم يعد صالحًا. اطلب رابطًا جديدًا من الإدارة.");
        }
        run(
            "UPDATE users SET password=?,active=1,auth_version=auth_version+1 WHERE id=?",
            [$hash ?? $fresh["user"]["password"], $fresh["user"]["id"]],
        );
        run("UPDATE account_invitations SET used_at=? WHERE id=?", [
            now(),
            $fresh["invite"]["id"],
        ]);
        run(
            "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE user_id=? AND kind='invitation' AND status IN ('pending','blocked','retry')",
            [now(), $fresh["user"]["id"]],
        );
        audit($fresh["user"], "account.email_verified", $fresh["user"]["id"]);
        queueEmail(
            "verified:" . $fresh["invite"]["id"],
            $fresh["user"]["id"],
            "account",
            "تم توثيق حسابكم في منصة تفاصيل التعليمية",
            "الأستاذ/ة " .
                $fresh["user"]["name"] .
                " المحترم/ة،\nتم توثيق بريدكم الإلكتروني وإكمال تسجيل حسابكم بنجاح. يمكنكم الآن تسجيل الدخول بكلمة المرور التي اخترتموها.\nإذا لم تقوموا بهذا الإجراء، يرجى التواصل مع إدارة مركز تفاصيل للتدريب فورًا.\nمع خالص التقدير،\nإدارة مركز تفاصيل للتدريب",
            "/login",
        );
        $courses =
            $fresh["user"]["role"] === "student"
                ? completeRequestedFreeCourses($fresh["user"]["id"])
                : [];
        return [
            "ok" => true,
            "next" => $courses
                ? "/courses/" . $courses[0]
                : (one(
                    "SELECT course_id FROM course_registration_requests WHERE student_id=?",
                    [$fresh["user"]["id"]],
                )
                    ? "/registrations"
                    : "/dashboard"),
        ];
    });
    if ($registration) {
        return loginUser(
            one("SELECT * FROM users WHERE id=?", [$found["user"]["id"]]),
        ) + $result;
    }
    return $result;
}
