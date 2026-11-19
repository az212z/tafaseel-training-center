<?php
declare(strict_types=1);
require_once __DIR__ . "/providers.php";
require_once __DIR__ . "/payments.php";
require_once __DIR__ . "/notifications.php";
require_once __DIR__ . "/zoom.php";
require_once __DIR__ . "/media.php";
function registrationInput(array $d): array
{
    $name = str($d["name"] ?? "", 120);
    $em = email($d["email"] ?? "");
    $pw = pass($d["password"] ?? "");
    $birth = str($d["birth_date"] ?? "", 12);
    $date = DateTimeImmutable::createFromFormat("!Y-m-d", $birth);
    if (
        !$date ||
        $date->format("Y-m-d") !== $birth ||
        $date > new DateTimeImmutable() ||
        $date < new DateTimeImmutable("-100 years")
    ) {
        fail(422, "تاريخ الميلاد غير صحيح.");
    }
    $minor = $date->diff(new DateTimeImmutable())->y < 18;
    $profile = [
        enc(phone($d["phone"] ?? "", !$minor)),
        $birth,
        str($d["city"] ?? "", 100, false),
        "",
        enc(str($d["guardian_name"] ?? "", 120, $minor)),
        enc(phone($d["guardian_phone"] ?? "", $minor)),
        null,
    ];
    if (($d["consent"] ?? false) !== true) {
        fail(422, "الموافقة على حفظ البيانات لأغراض التدريب مطلوبة.");
    }
    return [$name, $em, $pw, $profile];
}
function pagedList(
    string $query,
    string $count,
    array $args,
    int $page,
    int $size = 25,
    array $selectArgs = [],
): array {
    return [
        "items" => rows(
            $query . " LIMIT " . $size . " OFFSET " . ($page - 1) * $size,
            [...$selectArgs, ...$args],
        ),
        "total" => (int) one($count, $args)["n"],
        "page" => $page,
        "page_size" => $size,
    ];
}
function extensionAction(
    string $action,
    string $method,
    array $d,
    string $raw,
): ?array {
    $gets = [
        "catalog",
        "course.registration",
        "course.requests",
        "orders",
        "bags",
        "integrations",
        "notifications",
        "guardian.preference",
        "videos",
        "video.play",
        "zoom.presence",
        "students.list",
        "users.list",
        "lesson",
    ];
    $posts = [
        "register",
        "commerce.save",
        "checkout",
        "course.apply",
        "payment.refresh",
        "payment.recover",
        "payment.callback",
        "bag.save",
        "bag.item.save",
        "bag.item.remove",
        "guardian.preference.save",
        "notification.retry",
        "zoom.create",
        "zoom.link",
        "zoom.embed",
        "zoom.webhook",
        "video.create",
        "video.credentials",
        "video.sync",
        "video.lesson",
    ];
    if (!in_array($action, [...$gets, ...$posts], true)) {
        return null;
    }
    if ($method !== (in_array($action, $gets, true) ? "GET" : "POST")) {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    if (
        $method === "POST" &&
        !in_array($action, ["payment.callback", "zoom.webhook"], true)
    ) {
        csrf();
    }
    if ($action === "payment.callback") {
        return paymentCallback($d);
    }
    if ($action === "zoom.webhook") {
        return zoomWebhook($raw, $d);
    }
    if ($action === "register") {
        if (!(cfg()["registration_enabled"] ?? true)) {
            fail(403, "التسجيل المباشر مغلق. تواصل مع الإدارة.");
        }
        rate("register-ip:" . ($_SERVER["REMOTE_ADDR"] ?? ""), 6, 3600);
        if (!empty($d["website"])) {
            fail(422, "تعذّر تقديم الطلب.");
        }
        [$name, $em, $pw, $profile] = registrationInput($d);
        $course = str($d["course_id"] ?? "", 40, false);
        $verifyEmail = ($d["verify_email"] ?? false) === true;
        tx(function () use ($name, $em, $pw, $profile, $course, $verifyEmail) {
            if (one("SELECT id FROM users WHERE email=?", [$em])) {
                return;
            }
            if ($course) {
                lockRow("courses", $course);
                registrationCourse($course);
            }
            $id = uid();
            run(
                "INSERT INTO users(id,name,email,password,role,active,created_at) VALUES(?,?,?,?,'student',0,?)",
                [$id, $name, $em, password_hash($pw, PASSWORD_DEFAULT), now()],
            );
            run(
                "INSERT INTO profiles(phone,birth_date,city,identity_number,guardian_name,guardian_phone,guardian_id,consent_at,user_id) VALUES(?,?,?,?,?,?,?,?,?)",
                [...$profile, now(), $id],
            );
            if ($course) {
                recordCourseRequest($id, $course);
            }
            audit($id, "registration.requested", $id);
            if ($verifyEmail) {
                issueAccountInvitation($id, ["id" => $id], null, true);
            } else {
                queueEmail(
                    "registration:" . $id,
                    $id,
                    "registration",
                    "استلمنا طلب انضمامك إلى تفاصيل",
                    "وصل طلب إنشاء حسابك، وهو الآن بانتظار مراجعة الإدارة. سنرسل لك إشعارًا عند تفعيله. لا تعني هذه الرسالة اعتماد التسجيل في دورة.",
                    "/login",
                );
                emailAdmins(
                    "registration-admin:" . $id,
                    "طلب انضمام جديد إلى تفاصيل",
                    "ورد طلب إنشاء حساب متدرب جديد. راجع البيانات من قسم الحسابات قبل التفعيل.",
                    "/users",
                );
            }
        });
        return [
            "ok" => true,
            "message" => $verifyEmail
                ? "تحقّق من بريدك لتفعيل الحساب ومتابعة الدورة. إذا كان لديك حساب، سجّل دخولك لإكمال التسجيل."
                : ($course
                    ? "إن كان هذا بريدك الجديد، ستراجع الإدارة طلب تفعيل الحساب والدورة المختارة. إذا كان لديك حساب، سجّل دخولك لإكمال التسجيل."
                    : "تم استلام الطلب. تراجع الإدارة البيانات وتفعّل الحساب، أو تتواصل معك إذا كان البريد مسجلًا مسبقًا."),
        ];
    }
    $page = number($d["page"] ?? 1, 1, 1000000);
    if ($action === "catalog") {
        $search = str($d["search"] ?? "", 100, false);
        $query =
            " FROM courses c JOIN course_commerce o ON o.course_id=c.id LEFT JOIN users u ON u.id=c.instructor_id WHERE c.status='published' AND o.enrollment_open=1";
        $params = [];
        if ($search) {
            $query .= " AND (c.title LIKE ? OR c.category LIKE ?)";
            $params = ["%" . $search . "%", "%" . $search . "%"];
        }
        $targetCourse = str($d["course_id"] ?? "", 40, false);
        if ($targetCourse) {
            $query .= " AND c.id=?";
            $params[] = $targetCourse;
        }
        return pagedList(
            'SELECT c.id,c.title,c.description,c.category,c.image,c.duration,c.capacity,u.name instructor_name,o.price_minor,\'SAR\' currency,(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) students_count' .
                $query .
                " ORDER BY c.created_at DESC,c.id",
            "SELECT COUNT(*) n" . $query,
            $params,
            $page,
        );
    }
    $u = auth();
    staffMfaGuard($u, $action);
    switch ($action) {
        case "course.registration":
            auth(["student"]);
            return courseRequestState($u, str($d["id"] ?? "", 40));
        case "course.requests":
            auth(["admin", "student"]);
            return listCourseRequests($u, $page);
        case "course.apply":
            return checkout($u, str($d["course_id"] ?? "", 40), true);
        case "integrations":
            auth(["admin"]);
            return [
                "services" => integrationStatuses(),
                "worker_last_run" => setting("worker_last_run"),
                "storage" => [
                    "driver" => integrationEnabled("s3") ? "s3" : "local",
                    "file_limit_bytes" =>
                        (int) (cfg()["max_upload_bytes"] ?? 31457280),
                    "lesson_video_bytes" => lessonVideoLimit(),
                    "storage_quota_bytes" =>
                        (int) (cfg()["storage_quota_bytes"] ?? 2147483648),
                ],
                "registration_enabled" =>
                    (bool) (cfg()["registration_enabled"] ?? true),
            ];
        case "commerce.save":
            auth(["admin"]);
            $cid = str($d["course_id"] ?? "", 40);
            courseAccess($u, $cid, true);
            $price = number($d["price_minor"] ?? 0, 0, 100000000);
            if ($price > 0 && $price < 100) {
                fail(422, "أقل سعر مدفوع ريال واحد.");
            }
            $open = ($d["enrollment_open"] ?? false) === true ? 1 : 0;
            tx(function () use ($cid, $price, $open, $u) {
                lockRow("courses", $cid);
                if (
                    one(
                        "SELECT course_id FROM course_commerce WHERE course_id=?",
                        [$cid],
                    )
                ) {
                    run(
                        "UPDATE course_commerce SET price_minor=?,enrollment_open=?,updated_at=? WHERE course_id=?",
                        [$price, $open, now(), $cid],
                    );
                } else {
                    run(
                        "INSERT INTO course_commerce(course_id,price_minor,enrollment_open,updated_at) VALUES(?,?,?,?)",
                        [$cid, $price, $open, now()],
                    );
                }
                audit($u, "commerce.saved", $cid);
            });
            return ["ok" => true];
        case "checkout":
            return checkout($u, str($d["course_id"] ?? "", 40));
        case "orders":
            if (!in_array($u["role"], ["admin", "student"], true)) {
                fail(403, "سجل المدفوعات خاص بالإدارة وصاحب الطلب.");
            }
            $where = $u["role"] === "admin" ? "1=1" : "o.student_id=?";
            $args = $u["role"] === "admin" ? [] : [$u["id"]];
            $status = str($d["status"] ?? "", 30, false);
            if ($status) {
                if (
                    !in_array(
                        $status,
                        [
                            "creating",
                            "pending",
                            "paid",
                            "paid_review",
                            "uncertain",
                            "failed",
                            "expired",
                            "canceled",
                            "refunded",
                            "voided",
                        ],
                        true,
                    )
                ) {
                    fail(422, "حالة الدفع غير صحيحة.");
                }
                $where .= " AND o.status=?";
                $args[] = $status;
            }
            $search = str($d["search"] ?? "", 100, false);
            if ($search) {
                $where .=
                    " AND (o.id LIKE ? OR u.name LIKE ? OR c.title LIKE ?)";
                array_push(
                    $args,
                    "%" . $search . "%",
                    "%" . $search . "%",
                    "%" . $search . "%",
                );
            }
            $dates = [];
            foreach (["from", "to"] as $field) {
                $value = str($d[$field] ?? "", 10, false);
                if (!$value) {
                    continue;
                }
                $date = DateTimeImmutable::createFromFormat(
                    "!Y-m-d",
                    $value,
                    new DateTimeZone("Asia/Riyadh"),
                );
                if (!$date || $date->format("Y-m-d") !== $value) {
                    fail(422, "تاريخ تصفية المدفوعات غير صحيح.");
                }
                $dates[$field] = $date;
                $where .=
                    $field === "from"
                        ? " AND o.created_at>=?"
                        : " AND o.created_at<?";
                $args[] = ($field === "to" ? $date->modify("+1 day") : $date)
                    ->setTimezone(new DateTimeZone("UTC"))
                    ->format("Y-m-d\\TH:i:s\\Z");
            }
            if (
                isset($dates["from"], $dates["to"]) &&
                $dates["from"] > $dates["to"]
            ) {
                fail(422, "تاريخ البداية يجب أن يسبق تاريخ النهاية.");
            }
            $from =
                " FROM orders o JOIN users u ON u.id=o.student_id JOIN courses c ON c.id=o.course_id WHERE " .
                $where;
            $result = pagedList(
                "SELECT o.id,o.student_id,o.course_id,o.amount,o.currency,o.status,o.checkout_url,o.expires_at,o.created_at,o.paid_at,o.failure_code,u.name student_name,c.title course_title FROM orders o JOIN users u ON u.id=o.student_id JOIN courses c ON c.id=o.course_id WHERE " .
                    $where .
                    " ORDER BY o.created_at DESC,o.id",
                "SELECT COUNT(*) n" . $from,
                $args,
                $page,
            );
            $summary = one(
                "SELECT COALESCE(SUM(CASE WHEN o.status IN ('paid','paid_review') THEN o.amount ELSE 0 END),0) paid, COALESCE(SUM(CASE WHEN o.status IN ('creating','pending','uncertain') THEN o.amount ELSE 0 END),0) pending, COALESCE(SUM(CASE WHEN o.status='refunded' THEN o.amount ELSE 0 END),0) refunded, COALESCE(SUM(CASE WHEN o.status IN ('paid_review','uncertain') THEN 1 ELSE 0 END),0) review" .
                    $from,
                $args,
            );
            $result["summary"] = array_map("intval", $summary);
            return $result;
        case "payment.refresh":
            $o = orderAccess($u, str($d["id"] ?? "", 40));
            rate("payment-refresh:" . $u["id"], 30, 300);
            return ["order" => reconcileOrder($o["id"])];
        case "payment.recover":
            auth(["admin"]);
            $id = str($d["id"] ?? "", 40);
            $o = orderAccess($u, $id);
            if (
                !in_array($o["status"], ["creating", "uncertain"], true) ||
                $o["provider_id"]
            ) {
                fail(
                    409,
                    "استعادة رقم الفاتورة متاحة للطلبات غير المؤكدة فقط.",
                );
            }
            $pid = str($d["provider_id"] ?? "", 100);
            if (!preg_match('/^[a-f0-9-]{36}$/i', $pid)) {
                fail(422, "معرّف فاتورة ميسر غير صحيح.");
            }
            $r = invoiceRequest("GET", "/invoices/" . rawurlencode($pid));
            if (
                ($r["id"] ?? "") !== $pid ||
                (int) ($r["amount"] ?? -1) !== (int) $o["amount"] ||
                ($r["currency"] ?? "") !== $o["currency"] ||
                !str_ends_with($r["description"] ?? "", $o["id"])
            ) {
                fail(409, "الفاتورة لا تطابق الطلب.");
            }
            run(
                "UPDATE orders SET provider_id=?,updated_at=? WHERE id=? AND provider_id IS NULL",
                [$pid, now(), $id],
            );
            audit($u, "payment.invoice_recovered", $id);
            return ["order" => reconcileOrder($id)];
        case "bags":
            $cid = str($d["course_id"] ?? "", 40);
            courseAccess($u, $cid);
            $bags = rows(
                "SELECT * FROM learning_bags b WHERE course_id=? AND " .
                    recordAvailable("bag", "b.id") .
                    " ORDER BY updated_at DESC",
                [$cid],
            );
            foreach ($bags as &$b) {
                $b["items"] = rows(
                    "SELECT i.*,f.name,f.mime,f.bytes FROM bag_items i JOIN files f ON f.id=i.file_id WHERE i.bag_id=? ORDER BY i.sort_order,i.id",
                    [$b["id"]],
                );
            }
            return ["items" => $bags];
        case "bag.save":
            $cid = str($d["course_id"] ?? "", 40);
            courseAccess($u, $cid, true);
            $id = $d["id"] ?? "";
            $title = str($d["title"] ?? "", 200);
            $description = str($d["description"] ?? "", 5000, false);
            $version = str($d["version"] ?? "1.0", 50);
            if ($id) {
                if (
                    !one(
                        "SELECT id FROM learning_bags WHERE id=? AND course_id=?",
                        [$id, $cid],
                    )
                ) {
                    fail(404, "الحقيبة غير موجودة.");
                }
                run(
                    "UPDATE learning_bags SET title=?,description=?,version=?,updated_at=? WHERE id=?",
                    [$title, $description, $version, now(), $id],
                );
            } else {
                $id = uid();
                run(
                    "INSERT INTO learning_bags(id,course_id,title,description,version,updated_at) VALUES(?,?,?,?,?,?)",
                    [$id, $cid, $title, $description, $version, now()],
                );
            }
            audit($u, "bag.saved", $id);
            courseUpdate(
                $cid,
                "bag",
                $id,
                "حقيبة تعليمية: " . $title,
                "/bags?course=" . $cid,
            );
            return ["id" => $id];
        case "bag.item.save":
        case "bag.item.remove":
            $id = str($d["bag_id"] ?? "", 40);
            $bag = one(
                "SELECT * FROM learning_bags b WHERE id=? AND " .
                    recordAvailable("bag", "b.id"),
                [$id],
            );
            if (!$bag) {
                fail(404, "الحقيبة غير موجودة.");
            }
            courseAccess($u, $bag["course_id"], true);
            $file = str($d["file_id"] ?? "", 40);
            if ($action === "bag.item.remove") {
                run("DELETE FROM bag_items WHERE bag_id=? AND file_id=?", [
                    $id,
                    $file,
                ]);
                audit($u, "bag.item_removed", $id);
                return ["ok" => true];
            }
            checkFileRef($u, $file, "resource", $bag["course_id"]);
            $label = str($d["label"] ?? "", 200);
            $sort = number($d["sort_order"] ?? 0, 0, 10000);
            if (
                one("SELECT id FROM bag_items WHERE bag_id=? AND file_id=?", [
                    $id,
                    $file,
                ])
            ) {
                fail(409, "الملف مضاف إلى الحقيبة.");
            }
            run(
                "INSERT INTO bag_items(id,bag_id,file_id,label,sort_order) VALUES(?,?,?,?,?)",
                [uid(), $id, $file, $label, $sort],
            );
            audit($u, "bag.item_added", $id);
            courseUpdate(
                $bag["course_id"],
                "bag_item",
                $id . ":" . $file,
                "مادة جديدة في الحقيبة: " . $label,
                "/bags?course=" . $bag["course_id"],
            );
            return ["ok" => true];
        case "guardian.preference":
        case "guardian.preference.save":
            $sid = str($d["student_id"] ?? "", 40);
            studentAccess($u, $sid, true);
            if (!in_array($u["role"], ["admin", "guardian"], true)) {
                fail(403, "تفضيلات التواصل خاصة بالإدارة وولي الأمر.");
            }
            $pref = one(
                "SELECT sms_enabled,consent_at FROM guardian_preferences WHERE student_id=?",
                [$sid],
            );
            if ($action === "guardian.preference") {
                return [
                    "sms_enabled" => (bool) ($pref["sms_enabled"] ?? false),
                    "consent_at" => $pref["consent_at"] ?? null,
                ];
            }
            $enabled = ($d["sms_enabled"] ?? false) === true;
            $p = one("SELECT guardian_phone FROM profiles WHERE user_id=?", [
                $sid,
            ]);
            if (
                $enabled &&
                (!$p ||
                    !$p["guardian_phone"] ||
                    ($d["consent"] ?? false) !== true)
            ) {
                fail(422, "وثّق موافقة ولي الأمر وأضف جواله قبل تفعيل الرسائل.");
            }
            $consent = $enabled ? now() : null;
            tx(function () use ($pref, $sid, $enabled, $consent, $u) {
                if ($pref) {
                    run(
                        "UPDATE guardian_preferences SET sms_enabled=?,consent_at=?,updated_by=?,updated_at=? WHERE student_id=?",
                        [$enabled ? 1 : 0, $consent, $u["id"], now(), $sid],
                    );
                } else {
                    run(
                        "INSERT INTO guardian_preferences(student_id,sms_enabled,consent_at,updated_by,updated_at) VALUES(?,?,?,?,?)",
                        [$sid, $enabled ? 1 : 0, $consent, $u["id"], now()],
                    );
                }
                if (!$enabled) {
                    run(
                        "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE student_id=? AND status IN ('pending','retry','blocked')",
                        [now(), $sid],
                    );
                }
                audit($u, "guardian.sms_preference", $sid);
            });
            return ["ok" => true];
        case "notifications":
            return notificationRows($u, $page);
        case "notification.retry":
            auth(["admin"]);
            $id = str($d["id"] ?? "", 40);
            $n = one("SELECT * FROM notification_outbox WHERE id=?", [$id]);
            if (!$n || !in_array($n["status"], ["failed", "blocked"], true)) {
                fail(
                    409,
                    "يمكن إعادة الرسائل المرفوضة أو غير المفعّلة فقط. راجع المزود يدويًا للرسالة غير مؤكدة الحالة.",
                );
            }
            if ((int) $n["attempts"] >= 5) {
                fail(409, "تجاوزت الرسالة عدد المحاولات. راجع المزود.");
            }
            requireIntegration("sms");
            run(
                "UPDATE notification_outbox SET status='retry',next_attempt_at=?,updated_at=? WHERE id=?",
                [gmdate("Y-m-d\TH:i:s\Z", time() + 60), now(), $id],
            );
            audit($u, "sms.retry_requested", $id);
            return ["ok" => true];
        case "zoom.create":
            return createZoom(
                $u,
                str($d["class_id"] ?? "", 40),
                (string) ($d["host_email"] ?? ""),
            );
        case "zoom.link":
            return zoomLink(
                $u,
                str($d["class_id"] ?? "", 40),
                ($d["host"] ?? false) === true,
            );
        case "zoom.embed":
            return zoomEmbed(
                $u,
                str($d["class_id"] ?? "", 40),
                ($d["host"] ?? false) === true,
            );
        case "zoom.presence":
            $cid = str($d["class_id"] ?? "", 40);
            $c = one(
                "SELECT * FROM classes k WHERE id=? AND " .
                    recordAvailable("class", "k.id"),
                [$cid],
            );
            if (!$c) {
                fail(404, "الحصة غير موجودة.");
            }
            courseAccess($u, $c["course_id"], true);
            return [
                "items" => rows(
                    "SELECT p.student_id,p.joined_at,p.left_at,u.name FROM zoom_presence p JOIN users u ON u.id=p.student_id WHERE p.class_id=? ORDER BY p.joined_at",
                    [$cid],
                ),
            ];
        case "videos":
            auth(["admin", "instructor"]);
            $cid = str($d["course_id"] ?? "", 40);
            courseAccess($u, $cid, true);
            return pagedList(
                "SELECT id,course_id,lesson_id,title,status,bytes,created_at,updated_at FROM video_assets v WHERE course_id=? AND " .
                    recordAvailable("video", "v.id") .
                    " ORDER BY created_at DESC,id",
                "SELECT COUNT(*) n FROM video_assets v WHERE course_id=? AND " .
                    recordAvailable("video", "v.id"),
                [$cid],
                $page,
            );
        case "video.create":
            auth(["admin", "instructor"]);
            $cid = str($d["course_id"] ?? "", 40);
            courseAccess($u, $cid, true);
            requireIntegration("video");
            rate("video-create:" . $u["id"], 20, 3600);
            $title = str($d["title"] ?? "", 200);
            $bytes = number(
                $d["bytes"] ?? 0,
                1,
                (int) (cfg()["max_video_upload_bytes"] ?? 10737418240),
            );
            $r = videoRequest("POST", "", ["title" => $title]);
            $pid = (string) ($r["guid"] ?? "");
            if (!preg_match('/^[a-f0-9-]{36}$/i', $pid)) {
                throw new ProviderError("video_create_response", true);
            }
            $id = uid();
            run(
                "INSERT INTO video_assets(id,course_id,provider_id,title,status,bytes,created_by,created_at,updated_at) VALUES(?,?,?,?,'uploading',?,?,?,?)",
                [$id, $cid, $pid, $title, $bytes, $u["id"], now(), now()],
            );
            audit($u, "video.created", $id);
            return videoCredentials($u, $id);
        case "video.credentials":
            auth(["admin", "instructor"]);
            rate("video-sign:" . $u["id"], 60, 3600);
            return videoCredentials($u, str($d["id"] ?? "", 40));
        case "video.sync":
            auth(["admin", "instructor"]);
            rate("video-sync:" . $u["id"], 120, 3600);
            return syncVideo($u, str($d["id"] ?? "", 40));
        case "video.play":
            return videoPlayback($u, str($d["lesson_id"] ?? "", 40));
        case "video.lesson":
            auth(["admin", "instructor"]);
            $v = videoRow($u, str($d["asset_id"] ?? "", 40));
            if ($v["status"] !== "ready" || $v["lesson_id"]) {
                fail(409, "اختر فيديو جاهزًا وغير مرتبط بدرس.");
            }
            $title = str($d["title"] ?? "", 200);
            $body = str($d["body"] ?? "", 20000, false);
            $duration = number($d["duration"] ?? 0, 0, 10000);
            $sort = number($d["sort_order"] ?? 0, 0, 10000);
            return tx(function () use (
                $v,
                $title,
                $body,
                $duration,
                $sort,
                $u,
            ) {
                lockRow("video_assets", $v["id"]);
                $latest = one(
                    "SELECT lesson_id,status FROM video_assets WHERE id=?",
                    [$v["id"]],
                );
                if ($latest["lesson_id"] || $latest["status"] !== "ready") {
                    fail(409, "تغيرت حالة الفيديو.");
                }
                $id = uid();
                run(
                    "INSERT INTO lessons(id,course_id,title,kind,body,duration,sort_order,created_at) VALUES(?,?,?,'video',?,?,?,?)",
                    [
                        $id,
                        $v["course_id"],
                        $title,
                        $body,
                        $duration,
                        $sort,
                        now(),
                    ],
                );
                run(
                    "UPDATE video_assets SET lesson_id=?,updated_at=? WHERE id=?",
                    [$id, now(), $v["id"]],
                );
                audit($u, "video.lesson_created", $id);
                courseUpdate(
                    $v["course_id"],
                    "lesson",
                    $id,
                    "درس فيديو جديد: " . $title,
                    "/courses/" . $v["course_id"] . "?lesson=" . $id,
                );
                return ["id" => $id];
            });
        case "lesson":
            $l = one(
                "SELECT * FROM lessons l WHERE id=? AND " .
                    recordAvailable("lesson", "l.id"),
                [$d["id"] ?? ""],
            );
            if (!$l) {
                fail(404, "الدرس غير موجود.");
            }
            courseAccess($u, $l["course_id"]);
            return ["lesson" => $l];
        case "users.list":
            auth(["admin"]);
            $search = str($d["search"] ?? "", 100, false);
            $role = str($d["role"] ?? "", 20, false);
            $where = "1=1";
            $args = [];
            $id = str($d["id"] ?? "", 40, false);
            if ($id) {
                $where .= " AND id=?";
                $args[] = $id;
            }
            if ($role) {
                if (
                    !in_array(
                        $role,
                        ["admin", "student", "guardian", "instructor"],
                        true,
                    )
                ) {
                    fail(422, "نوع الحساب غير صحيح.");
                }
                $where .= " AND role=?";
                $args[] = $role;
            }
            if ($search) {
                $where .= " AND (name LIKE ? OR email LIKE ?)";
                $args[] = "%" . $search . "%";
                $args[] = "%" . $search . "%";
            }
            $result = pagedList(
                "SELECT id,name,email,role,active,created_at FROM users u WHERE " .
                    recordAvailable("account", "u.id") .
                    " AND " .
                    $where .
                    " ORDER BY created_at DESC,id",
                "SELECT COUNT(*) n FROM users u WHERE " .
                    recordAvailable("account", "u.id") .
                    " AND " .
                    $where,
                $args,
                $page,
            );
            if ($result["items"]) {
                $ids = array_column($result["items"], "id");
                $holders = implode(",", array_fill(0, count($ids), "?"));
                $invites = array_column(
                    rows(
                        "SELECT user_id,expires_at,revoked_at FROM account_invitations WHERE used_at IS NULL AND user_id IN ($holders)",
                        $ids,
                    ),
                    null,
                    "user_id",
                );
                foreach ($result["items"] as &$item) {
                    if (isset($invites[$item["id"]])) {
                        $item["invitation_status"] = $invites[$item["id"]][
                            "revoked_at"
                        ]
                            ? "revoked"
                            : ($invites[$item["id"]]["expires_at"] > now()
                                ? "pending"
                                : "expired");
                    }
                }
                unset($item);
            }
            $result["role_counts"] = [];
            foreach (
                rows("SELECT role,COUNT(*) n FROM users GROUP BY role")
                as $count
            ) {
                $result["role_counts"][$count["role"]] = (int) $count["n"];
            }
            return $result;
        case "students.list":
            auth(["admin", "instructor", "guardian"]);
            $search = str($d["search"] ?? "", 100, false);
            $sql =
                " FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='student' AND " .
                recordAvailable("account", "u.id");
            $args = [];
            $countScope = "";
            $countArgs = [];
            if ($u["role"] === "instructor") {
                $countScope =
                    " AND c.instructor_id=? AND " .
                    recordAvailable("course", "c.id");
                $countArgs = [$u["id"]];
                $sql .=
                    " AND u.id IN (SELECT e.student_id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE c.instructor_id=? AND " .
                    recordAvailable("course", "c.id") .
                    ")";
                $args[] = $u["id"];
            } elseif ($u["role"] === "guardian") {
                $sql .= " AND p.guardian_id=?";
                $args[] = $u["id"];
            }
            if ($search) {
                $sql .= " AND (u.name LIKE ? OR u.email LIKE ?)";
                $args[] = "%" . $search . "%";
                $args[] = "%" . $search . "%";
            }
            return pagedList(
                "SELECT u.id,u.name,u.email,u.active,u.role,u.created_at,p.city,(SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=u.id$countScope) courses_count" .
                    $sql .
                    " ORDER BY u.created_at DESC,u.id",
                "SELECT COUNT(*) n" . $sql,
                $args,
                $page,
                25,
                $countArgs,
            );
    }
    throw new LogicException("Unhandled extension");
}
function seedDemoV2(): void
{
    if (
        cfg()["environment"] !== "local" ||
        !cfg()["demo"] ||
        setting("v2_demo_initialized")
    ) {
        return;
    }
    tx(function () {
        $available = one(
            "SELECT id FROM courses WHERE status='draft' ORDER BY created_at DESC LIMIT 1",
        );
        if ($available) {
            run("UPDATE courses SET status='published' WHERE id=?", [
                $available["id"],
            ]);
        }
        foreach (
            rows(
                "SELECT id,title FROM courses WHERE status='published' ORDER BY created_at",
            )
            as $i => $c
        ) {
            if (
                !one(
                    "SELECT course_id FROM course_commerce WHERE course_id=?",
                    [$c["id"]],
                )
            ) {
                run(
                    "INSERT INTO course_commerce(course_id,price_minor,enrollment_open,updated_at) VALUES(?,?,1,?)",
                    [
                        $c["id"],
                        $available && $c["id"] === $available["id"]
                            ? 19900
                            : ($i === 0
                                ? 0
                                : 29900),
                        now(),
                    ],
                );
            }
        }
        $c = one(
            "SELECT id FROM courses WHERE status='published' ORDER BY created_at LIMIT 1",
        );
        if (
            $c &&
            !one("SELECT id FROM learning_bags WHERE course_id=?", [$c["id"]])
        ) {
            run(
                "INSERT INTO learning_bags(id,course_id,title,description,version,updated_at) VALUES(?,?,?,?,?,?)",
                [
                    uid(),
                    $c["id"],
                    "نموذج حقيبة تعليمية للتجربة",
                    "أضف دليل المتعلم وأوراق العمل والملخصات من حساب الإدارة أو المدرب. هذا نموذج فارغ للتجربة، وليس محتوى معتمدًا للدورة.",
                    "1.0",
                    now(),
                ],
            );
        }
        setSetting("v2_demo_initialized", true);
    });
}
