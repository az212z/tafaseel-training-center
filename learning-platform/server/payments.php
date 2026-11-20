<?php
declare(strict_types=1);
function commerceFor(string $course): array
{
    return one("SELECT * FROM course_commerce WHERE course_id=?", [
        $course,
    ]) ?? ["course_id" => $course, "price_minor" => 0, "enrollment_open" => 0];
}
function reservedSeats(string $course, ?string $except = null): int
{
    return (int) one(
        "SELECT COUNT(*) n FROM orders WHERE course_id=? AND status IN ('creating','pending','uncertain') AND expires_at>?" .
            ($except ? " AND id<>?" : ""),
        $except ? [$course, now(), $except] : [$course, now()],
    )["n"];
}
function orderView(array $row): array
{
    return array_intersect_key(
        $row,
        array_flip([
            "id",
            "student_id",
            "course_id",
            "amount",
            "currency",
            "status",
            "checkout_url",
            "expires_at",
            "created_at",
            "updated_at",
            "paid_at",
            "failure_code",
        ]),
    );
}
function orderAccess(array $u, string $id): array
{
    $r = one("SELECT * FROM orders WHERE id=?", [$id]);
    if (!$r) {
        fail(404, "طلب الدفع غير موجود.");
    }
    if (
        $u["role"] !== "admin" &&
        ($u["role"] !== "student" || $u["id"] !== $r["student_id"])
    ) {
        fail(403, "طلب الدفع غير متاح لحسابك.");
    }
    return $r;
}
function invoiceRequest(
    string $method,
    string $path,
    ?array $payload = null,
): array {
    $c = requireIntegration("moyasar");
    return providerRequest("moyasar", $method, $path, $payload, [
        "Authorization: Basic " . base64_encode($c["secret_key"] . ":"),
    ]);
}
function reconcileOrder(string $id): array
{
    $o = one("SELECT * FROM orders WHERE id=?", [$id]);
    if (!$o || !$o["provider_id"]) {
        fail(409, "الطلب يحتاج مراجعة الإدارة قبل إعادة المحاولة.");
    }
    $invoice = invoiceRequest(
        "GET",
        "/invoices/" . rawurlencode($o["provider_id"]),
    );
    if (
        ($invoice["id"] ?? "") !== $o["provider_id"] ||
        (int) ($invoice["amount"] ?? -1) !== (int) $o["amount"] ||
        ($invoice["currency"] ?? "") !== $o["currency"]
    ) {
        audit(null, "payment.verification_mismatch", $id);
        fail(409, "بيانات بوابة الدفع لا تطابق الطلب. أُحيل للمراجعة.");
    }
    $status = $invoice["status"] ?? "";
    $allowed = [
        "initiated",
        "paid",
        "failed",
        "refunded",
        "canceled",
        "on_hold",
        "expired",
        "voided",
    ];
    if (!in_array($status, $allowed, true)) {
        throw new ProviderError("invoice_status");
    }
    return tx(function () use ($o, $status) {
        lockRow("courses", $o["course_id"]);
        lockRow("orders", $o["id"]);
        $latest = one("SELECT * FROM orders WHERE id=?", [$o["id"]]);
        if ($latest["provider_id"] !== $o["provider_id"]) {
            fail(409, "تغير الطلب. حدّث الصفحة.");
        }
        if ($status === "paid") {
            if (in_array($latest["status"], ["paid", "paid_review"], true)) {
                return orderView($latest);
            }
            $course = one("SELECT * FROM courses WHERE id=?", [
                $o["course_id"],
            ]);
            $student = one(
                "SELECT id FROM users WHERE id=? AND active=1 AND role='student'",
                [$o["student_id"]],
            );
            $enrolled = one(
                "SELECT id FROM enrollments WHERE course_id=? AND student_id=?",
                [$o["course_id"], $o["student_id"]],
            );
            $count = (int) one(
                "SELECT COUNT(*) n FROM enrollments WHERE course_id=?",
                [$o["course_id"]],
            )["n"];
            $newStatus =
                !$student ||
                $course["status"] !== "published" ||
                (!$enrolled && $count >= (int) $course["capacity"])
                    ? "paid_review"
                    : "paid";
            if ($newStatus === "paid" && !$enrolled) {
                run(
                    "INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)",
                    [uid(), $o["course_id"], $o["student_id"], now()],
                );
                emailEnrollment($o["course_id"], $o["student_id"]);
            }
            run(
                "UPDATE orders SET status=?,paid_at=?,updated_at=?,failure_code=? WHERE id=?",
                [
                    $newStatus,
                    now(),
                    now(),
                    $newStatus === "paid_review"
                        ? "enrollment_review_required"
                        : null,
                    $o["id"],
                ],
            );
            audit($o["student_id"], "payment." . $newStatus, $o["id"]);
        } elseif ($status === "refunded") {
            run(
                "UPDATE orders SET status='refunded',updated_at=?,failure_code='refund_requires_access_review' WHERE id=?",
                [now(), $o["id"]],
            );
            audit(null, "payment.refunded", $o["id"]);
        } elseif (
            !in_array(
                $latest["status"],
                ["paid", "paid_review", "refunded"],
                true,
            )
        ) {
            $next = in_array($status, ["initiated", "on_hold"], true)
                ? "pending"
                : $status;
            run("UPDATE orders SET status=?,updated_at=? WHERE id=?", [
                $next,
                now(),
                $o["id"],
            ]);
        }
        return orderView(one("SELECT * FROM orders WHERE id=?", [$o["id"]]));
    });
}
function registrationCourse(string $id): array
{
    $course = one(
        "SELECT c.id,c.title,c.capacity,o.price_minor FROM courses c JOIN course_commerce o ON o.course_id=c.id WHERE c.id=? AND c.status='published' AND o.enrollment_open=1",
        [$id],
    );
    if (!$course) {
        fail(404, "التسجيل غير متاح في هذه الدورة.");
    }
    return $course;
}
function recordCourseRequest(string $student, string $course): void
{
    if (
        !one(
            "SELECT course_id FROM course_registration_requests WHERE student_id=? AND course_id=?",
            [$student, $course],
        )
    ) {
        run(
            "INSERT INTO course_registration_requests(student_id,course_id,created_at) VALUES(?,?,?)",
            [$student, $course, now()],
        );
        audit($student, "course.registration_requested", $course);
    }
}
function isEnrolled(string $student, string $course): bool
{
    return (bool) one(
        "SELECT id FROM enrollments WHERE course_id=? AND student_id=?",
        [$course, $student],
    );
}
function courseHasSeat(string $course, int $capacity): bool
{
    return (int) one("SELECT COUNT(*) n FROM enrollments WHERE course_id=?", [
        $course,
    ])["n"] +
        reservedSeats($course) <
        $capacity;
}
function addSelfEnrollment(string $student, string $course): void
{
    run(
        "INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)",
        [uid(), $course, $student, now()],
    );
    emailEnrollment($course, $student);
    audit($student, "student.self_enrolled", $course);
}
function completeRequestedFreeCourses(string $student): array
{
    $result = [];
    foreach (
        rows(
            "SELECT course_id FROM course_registration_requests WHERE student_id=? ORDER BY course_id",
            [$student],
        )
        as $request
    ) {
        $cid = $request["course_id"];
        lockRow("courses", $cid);
        if (isEnrolled($student, $cid)) {
            continue;
        }
        $course = one(
            "SELECT c.title,c.capacity,o.price_minor FROM courses c JOIN course_commerce o ON o.course_id=c.id WHERE c.id=? AND c.status='published' AND o.enrollment_open=1",
            [$cid],
        );
        if (
            $course &&
            (int) $course["price_minor"] === 0 &&
            courseHasSeat($cid, (int) $course["capacity"])
        ) {
            addSelfEnrollment($student, $cid);
            $result[] = $cid;
        }
    }
    return $result;
}
function courseRequestState(array $u, string $cid): array
{
    return [
        "enrolled" => isEnrolled($u["id"], $cid),
        "requested" => (bool) one(
            "SELECT course_id FROM course_registration_requests WHERE student_id=? AND course_id=?",
            [$u["id"], $cid],
        ),
        "payment_available" => integrationEnabled("moyasar"),
    ];
}
function listCourseRequests(array $u, int $page): array
{
    $scope = $u["role"] === "admin" ? "" : " WHERE r.student_id=?";
    $args = $u["role"] === "admin" ? [] : [$u["id"]];
    $query =
        " FROM course_registration_requests r JOIN courses c ON c.id=r.course_id JOIN users u ON u.id=r.student_id LEFT JOIN course_commerce o ON o.course_id=c.id LEFT JOIN enrollments e ON e.course_id=r.course_id AND e.student_id=r.student_id";
    $result = pagedList(
        "SELECT r.student_id,r.course_id,r.created_at,c.title,c.status course_status,o.price_minor,o.enrollment_open,u.name student_name,u.active,e.id enrollment_id" .
            $query .
            $scope .
            " ORDER BY r.created_at DESC,r.student_id,r.course_id",
        "SELECT COUNT(*) n" . $query . $scope,
        $args,
        $page,
    );
    $result["payment_available"] = integrationEnabled("moyasar");
    foreach ($result["items"] as &$item) {
        $item["status"] = $item["enrollment_id"]
            ? "enrolled"
            : (!$item["active"]
                ? "pending_account"
                : ($item["course_status"] !== "published" ||
                !$item["enrollment_open"]
                    ? "unavailable"
                    : ((int) $item["price_minor"]
                        ? "payment_required"
                        : "awaiting_seat")));
        unset(
            $item["active"],
            $item["enrollment_id"],
            $item["course_status"],
            $item["enrollment_open"],
        );
        if ($u["role"] !== "admin") {
            unset($item["student_name"], $item["student_id"]);
        }
    }
    unset($item);
    return $result;
}
function checkout(array $u, string $courseId, bool $application = false): array
{
    if ($u["role"] !== "student") {
        fail(403, "التسجيل الذاتي متاح من حساب الطالب.");
    }
    rate("checkout:" . $u["id"], 15, 900);
    $order = tx(function () use ($u, $courseId, $application) {
        lockRow("courses", $courseId);
        if (
            $application &&
            isEnrolled($u["id"], $courseId) &&
            one("SELECT id FROM courses WHERE id=? AND status='published'", [
                $courseId,
            ])
        ) {
            return ["free" => true];
        }
        $course = registrationCourse($courseId);
        if (isEnrolled($u["id"], $courseId)) {
            fail(409, "أنت مسجل في الدورة بالفعل.");
        }
        $old = one(
            "SELECT * FROM orders WHERE course_id=? AND student_id=? AND status IN ('creating','pending','uncertain','paid_review') ORDER BY created_at DESC LIMIT 1",
            [$courseId, $u["id"]],
        );
        if ($old) {
            if ($application) {
                recordCourseRequest($u["id"], $courseId);
            }
            return $old;
        }
        if (!courseHasSeat($courseId, (int) $course["capacity"])) {
            fail(409, "اكتمل عدد المقاعد في الدورة.");
        }
        $price = (int) $course["price_minor"];
        if ($application) {
            recordCourseRequest($u["id"], $courseId);
        }
        if ($price === 0) {
            addSelfEnrollment($u["id"], $courseId);
            return ["free" => true];
        }
        if ($application && !integrationEnabled("moyasar")) {
            return ["application_only" => true];
        }
        requireIntegration("moyasar");
        $id = uid();
        $expires = gmdate("Y-m-d\TH:i:s\Z", time() + 1800);
        run(
            "INSERT INTO orders(id,student_id,course_id,amount,currency,status,expires_at,created_at,updated_at) VALUES(?,?,?,?,'SAR','creating',?,?,?)",
            [$id, $u["id"], $courseId, $price, $expires, now(), now()],
        );
        return one("SELECT * FROM orders WHERE id=?", [$id]) + [
            "new" => true,
            "course_title" => $course["title"],
        ];
    });
    if (isset($order["free"])) {
        return ["enrolled" => true];
    }
    if (isset($order["application_only"])) {
        return ["enrolled" => false, "requested" => true];
    }
    if (!isset($order["new"])) {
        return ["order" => orderView($order), "enrolled" => false];
    }
    $base = rtrim(cfg()["origin"], "/");
    $token = hash_hmac("sha256", "invoice:" . $order["id"], cfg()["key"]);
    try {
        $r = invoiceRequest("POST", "/invoices", [
            "amount" => (int) $order["amount"],
            "currency" => "SAR",
            "description" =>
                "تفاصيل — " . $order["course_title"] . " — " . $order["id"],
            "callback_url" =>
                $base .
                "/api/index.php?action=payment.callback&order=" .
                $order["id"] .
                "&token=" .
                $token,
            "success_url" => $base . "/payments?order=" . $order["id"],
            "back_url" => $base . "/payments?order=" . $order["id"],
            "expired_at" => $order["expires_at"],
        ]);
        $providerId = (string) ($r["id"] ?? "");
        $url = (string) ($r["url"] ?? "");
        if (
            !preg_match('/^[a-f0-9-]{36}$/i', $providerId) ||
            parse_url($url, PHP_URL_SCHEME) !== "https" ||
            !in_array(
                parse_url($url, PHP_URL_HOST),
                ["checkout.moyasar.com", "moyasar.com"],
                true,
            ) ||
            (int) ($r["amount"] ?? -1) !== (int) $order["amount"] ||
            ($r["currency"] ?? "") !== "SAR"
        ) {
            throw new ProviderError("invoice_response", true);
        }
        run(
            "UPDATE orders SET provider_id=?,checkout_url=?,status='pending',updated_at=? WHERE id=?",
            [$providerId, $url, now(), $order["id"]],
        );
        audit($u, "payment.initiated", $order["id"]);
    } catch (ProviderError $e) {
        run(
            "UPDATE orders SET status=?,failure_code=?,updated_at=? WHERE id=?",
            [
                $e->uncertain ? "uncertain" : "failed",
                $e->reason,
                now(),
                $order["id"],
            ],
        );
        audit($u, "payment.creation_failed", $order["id"]);
        if (!$e->uncertain) {
            fail(502, "رفض مزود الدفع إنشاء الطلب. لم يتم تأكيد دفع.");
        }
    }
    return [
        "order" => orderView(
            one("SELECT * FROM orders WHERE id=?", [$order["id"]]),
        ),
        "enrolled" => false,
    ];
}
function paymentCallback(array $d): array
{
    requireIntegration("moyasar");
    $id = (string) ($_GET["order"] ?? "");
    $token = (string) ($_GET["token"] ?? "");
    if (
        !hash_equals(
            hash_hmac("sha256", "invoice:" . $id, cfg()["key"]),
            $token,
        )
    ) {
        fail(403, "طلب غير موثوق.");
    }
    $o = one("SELECT id,provider_id FROM orders WHERE id=?", [$id]);
    if (!$o || !$o["provider_id"] || ($d["id"] ?? "") !== $o["provider_id"]) {
        fail(404, "الطلب غير موجود.");
    }
    rate("invoice-callback:" . $id, 20, 300);
    reconcileOrder($id);
    return ["ok" => true];
}
