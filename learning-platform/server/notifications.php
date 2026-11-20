<?php
declare(strict_types=1);
function syncAbsenceNotice(
    string $classId,
    string $studentId,
    string $status,
    bool $automatic = false,
): void {
    $key = "absence:" . $classId . ":" . $studentId;
    $existing = one("SELECT * FROM notification_outbox WHERE dedupe_key=?", [
        $key,
    ]);
    if ($status !== "absent") {
        if (
            $existing &&
            in_array($existing["status"], ["pending", "retry", "blocked"], true)
        ) {
            run(
                "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE id=?",
                [now(), $existing["id"]],
            );
        }
        return;
    }
    if (
        $existing &&
        in_array(
            $existing["status"],
            ["accepted", "sending", "uncertain"],
            true,
        )
    ) {
        return;
    }
    $p = one(
        "SELECT p.guardian_phone,p.guardian_name,g.sms_enabled FROM profiles p LEFT JOIN guardian_preferences g ON g.student_id=p.user_id WHERE p.user_id=?",
        [$studentId],
    );
    if (!$p || !$p["sms_enabled"] || !$p["guardian_phone"]) {
        return;
    }
    $c = one(
        "SELECT k.title,k.starts_at,c.title course_title,u.name FROM classes k JOIN courses c ON c.id=k.course_id JOIN users u ON u.id=? WHERE k.id=?",
        [$studentId, $classId],
    );
    $date = (new DateTimeImmutable($c["starts_at"]))
        ->setTimezone(new DateTimeZone("Asia/Riyadh"))
        ->format("Y-m-d H:i");
    $body =
        "مركز تفاصيل للتدريب: نود إشعاركم بغياب الطالب/ة " .
        $c["name"] .
        " عن حصة " .
        $c["course_title"] .
        " بتاريخ " .
        $date .
        ". للاستفسار يرجى التواصل مع إدارة المركز.";
    $rule = one(
        "SELECT started_at FROM class_attendance_automation WHERE class_id=? AND enabled=1",
        [$classId],
    );
    $start = max(
        strtotime($c["starts_at"]),
        strtotime($rule["started_at"] ?? "") ?: 0,
    );
    $ready = gmdate(
        "Y-m-d\TH:i:s\Z",
        max(time() + ($automatic ? 0 : 300), $start + 1200),
    );
    $status = integrationEnabled("sms") ? "pending" : "blocked";
    if ($existing) {
        run(
            "UPDATE notification_outbox SET recipient=?,body=?,status=?,next_attempt_at=?,kind=?,error_code=NULL,updated_at=? WHERE id=?",
            [
                enc(dec($p["guardian_phone"])),
                enc($body),
                $status,
                $ready,
                $automatic ? "absence_auto" : "absence",
                now(),
                $existing["id"],
            ],
        );
    } else {
        run(
            "INSERT INTO notification_outbox(id,dedupe_key,student_id,class_id,kind,recipient,body,status,next_attempt_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            [
                uid(),
                $key,
                $studentId,
                $classId,
                $automatic ? "absence_auto" : "absence",
                enc(dec($p["guardian_phone"])),
                enc($body),
                $status,
                $ready,
                now(),
                now(),
            ],
        );
    }
}
function notificationRows(array $u, int $page = 1): array
{
    if ($u["role"] === "admin") {
        $where = "1=1";
        $params = [];
    } elseif ($u["role"] === "guardian") {
        $where =
            "n.student_id IN (SELECT user_id FROM profiles WHERE guardian_id=?)";
        $params = [$u["id"]];
    } else {
        fail(403, "سجل الرسائل خاص بالإدارة وولي الأمر.");
    }
    $total = (int) one(
        "SELECT COUNT(*) n FROM notification_outbox n WHERE " . $where,
        $params,
    )["n"];
    $offset = ($page - 1) * 25;
    $items = rows(
        "SELECT n.id,n.student_id,n.class_id,n.status,n.attempts,n.provider_id,n.error_code,n.created_at,n.updated_at,n.recipient,u.name student_name,c.title class_title FROM notification_outbox n JOIN users u ON u.id=n.student_id JOIN classes c ON c.id=n.class_id WHERE " .
            $where .
            " ORDER BY n.created_at DESC,n.id LIMIT 25 OFFSET " .
            $offset,
        $params,
    );
    foreach ($items as &$item) {
        $phone = dec($item["recipient"]);
        $item["recipient"] = "••••" . substr($phone, -4);
        if ($u["role"] !== "admin") {
            unset($item["attempts"], $item["provider_id"], $item["error_code"]);
        }
    }
    return [
        "items" => $items,
        "total" => $total,
        "page" => $page,
        "page_size" => 25,
    ];
}
function claimSmsNotice(array $entry): ?array
{
    return tx(function () use ($entry) {
        lockRow("storage_locks", "sms");
        lockRow("classes", $entry["class_id"]);
        lockRow("notification_outbox", $entry["id"]);
        $n = one("SELECT * FROM notification_outbox WHERE id=?", [
            $entry["id"],
        ]);
        if (
            !in_array($n["status"], ["pending", "retry", "blocked"], true) ||
            $n["next_attempt_at"] > now()
        ) {
            return null;
        }
        $attendance = one(
            "SELECT status FROM attendance WHERE class_id=? AND student_id=?",
            [$n["class_id"], $n["student_id"]],
        );
        $p = one(
            "SELECT p.guardian_phone,g.sms_enabled FROM profiles p JOIN guardian_preferences g ON g.student_id=p.user_id JOIN users u ON u.id=p.user_id AND u.active=1 WHERE p.user_id=?",
            [$n["student_id"]],
        );
        if (
            !$attendance ||
            $attendance["status"] !== "absent" ||
            !$p ||
            !$p["sms_enabled"] ||
            !$p["guardian_phone"]
        ) {
            run(
                "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE id=?",
                [now(), $n["id"]],
            );
            return ["cancelled" => true];
        }
        $class = one("SELECT ends_at FROM classes WHERE id=?", [
            $n["class_id"],
        ]);
        if (!$class || strtotime($class["ends_at"]) < time() - 3600) {
            run(
                "UPDATE notification_outbox SET status='cancelled',error_code='absence_expired',updated_at=? WHERE id=?",
                [now(), $n["id"]],
            );
            return ["cancelled" => true];
        }
        if ($n["kind"] === "absence_auto") {
            $rule = one(
                "SELECT enabled,needs_review FROM class_attendance_automation WHERE class_id=?",
                [$n["class_id"]],
            );
            if (!$rule || !$rule["enabled"] || $rule["needs_review"]) {
                run(
                    "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE id=?",
                    [now(), $n["id"]],
                );
                return ["cancelled" => true];
            }
        }
        if (!integrationEnabled("sms")) {
            run(
                "UPDATE notification_outbox SET status='blocked',error_code='provider_not_configured',next_attempt_at=?,updated_at=? WHERE id=?",
                [gmdate("Y-m-d\TH:i:s\Z", time() + 300), now(), $n["id"]],
            );
            return ["blocked" => true];
        }
        $minute = gmdate("Y-m-d\TH:i:s\Z", time() - 60);
        if (
            (int) one(
                "SELECT COUNT(*) n FROM sms_attempts WHERE created_at>?",
                [$minute],
            )["n"] >= deliveryLimits()["sms_per_minute"]
        ) {
            run("UPDATE notification_outbox SET next_attempt_at=? WHERE id=?", [
                gmdate("Y-m-d\TH:i:s\Z", time() + 60),
                $n["id"],
            ]);
            return ["deferred" => true];
        }
        run(
            "INSERT INTO sms_attempts(id,message_id,created_at) VALUES(?,?,?)",
            [uid(), $n["id"], now()],
        );
        $token = uid();
        run(
            "UPDATE notification_outbox SET status='sending',recipient=?,attempts=attempts+1,lock_token=?,locked_until=?,updated_at=? WHERE id=?",
            [
                enc(dec($p["guardian_phone"])),
                $token,
                gmdate("Y-m-d\TH:i:s\Z", time() + 90),
                now(),
                $n["id"],
            ],
        );
        $n["recipient"] = enc(dec($p["guardian_phone"]));
        $n["lock_token"] = $token;
        $n["attempts"]++;
        return $n;
    });
}
function finishSmsNotice(array $claim, array|ProviderError $response): string
{
    try {
        if ($response instanceof ProviderError) {
            throw $response;
        }
        $r = $response;
        if ((int) ($r["statusCode"] ?? 0) !== 201 || empty($r["messageId"])) {
            throw new ProviderError("sms_not_accepted", false);
        }
        run(
            "UPDATE notification_outbox SET status='accepted',provider_id=?,locked_until=NULL,lock_token=NULL,error_code=NULL,updated_at=? WHERE id=? AND lock_token=?",
            [
                (string) $r["messageId"],
                now(),
                $claim["id"],
                $claim["lock_token"],
            ],
        );
        audit(null, "sms.accepted", $claim["id"]);
        return "accepted";
    } catch (ProviderError $e) {
        $status = $e->uncertain
            ? "uncertain"
            : ($e->reason === "http_429" && (int) $claim["attempts"] < 4
                ? "retry"
                : "failed");
        run(
            "UPDATE notification_outbox SET status=?,error_code=?,locked_until=NULL,lock_token=NULL,updated_at=? WHERE id=? AND lock_token=?",
            [$status, $e->reason, now(), $claim["id"], $claim["lock_token"]],
        );
        if ($status === "retry") {
            run("UPDATE notification_outbox SET next_attempt_at=? WHERE id=?", [
                gmdate(
                    "Y-m-d\TH:i:s\Z",
                    time() + min(3600, 60 * 2 ** (int) $claim["attempts"]),
                ),
                $claim["id"],
            ]);
        }
        return $status;
    }
}
function dispatchNotifications(
    ?int $limit = null,
    ?float $deadline = null,
): array {
    setSetting("worker_last_run", now());
    $limits = deliveryLimits();
    $limit ??= $limits["sms_per_minute"];
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
        "UPDATE notification_outbox SET status='uncertain',error_code='worker_lease_expired',updated_at=? WHERE status='sending' AND locked_until<?",
        [now(), now()],
    );
    $entries = rows(
        "SELECT id,class_id FROM notification_outbox WHERE status IN ('pending','retry','blocked') AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT " .
            max(1, min(6000, $limit)),
        [now()],
    );
    foreach (array_chunk($entries, (int) $limits["sms_parallel"]) as $batch) {
        if ($deadline !== null && microtime(true) >= $deadline) {
            break;
        }
        $claims = [];
        $requests = [];
        $config = integrationConfig("sms");
        foreach ($batch as $entry) {
            $claim = claimSmsNotice($entry);
            if (!$claim) {
                continue;
            }
            foreach (["cancelled", "blocked", "deferred"] as $state) {
                if (isset($claim[$state])) {
                    $result[$state]++;
                    continue 2;
                }
            }
            $id = $claim["id"];
            $claims[$id] = $claim;
            $requests[$id] = [
                "method" => "POST",
                "path" => "/messages",
                "body" => [
                    "recipients" => [ltrim(dec($claim["recipient"]), "+")],
                    "body" => dec($claim["body"]),
                    "sender" => $config["sender"],
                ],
                "headers" => ["Authorization: Bearer " . $config["token"]],
            ];
        }
        if (!$requests) {
            continue;
        }
        try {
            $responses = providerRequestBatch("sms", $requests, $deadline);
        } catch (ProviderError $error) {
            $responses = array_fill_keys(array_keys($requests), $error);
        }
        foreach ($claims as $id => $claim) {
            $result[finishSmsNotice($claim, $responses[$id])]++;
        }
    }
    return $result;
}
