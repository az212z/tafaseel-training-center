<?php
declare(strict_types=1);
function zoomToken(): string
{
    $c = requireIntegration("zoom");
    $cached = setting("zoom_token");
    if ($cached && ($cached["expires"] ?? 0) > time() + 90) {
        return dec($cached["token"]);
    }
    $r = providerRequest(
        "zoom_auth",
        "POST",
        "/oauth/token",
        [
            "grant_type" => "account_credentials",
            "account_id" => $c["account_id"],
        ],
        [
            "Authorization: Basic " .
            base64_encode($c["client_id"] . ":" . $c["client_secret"]),
        ],
        true,
    );
    if (empty($r["access_token"])) {
        throw new ProviderError("zoom_token");
    }
    setSetting("zoom_token", [
        "token" => enc($r["access_token"]),
        "expires" => time() + (int) ($r["expires_in"] ?? 3600),
    ]);
    return $r["access_token"];
}
function zoomRequest(string $method, string $path, ?array $body = null): array
{
    return providerRequest("zoom", $method, $path, $body, [
        "Authorization: Bearer " . zoomToken(),
    ]);
}
function validZoomUrl(string $url): string
{
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?? "");
    if (
        parse_url($url, PHP_URL_SCHEME) !== "https" ||
        !($host === "zoom.us" || str_ends_with($host, ".zoom.us")) ||
        parse_url($url, PHP_URL_USER) ||
        parse_url($url, PHP_URL_PASS)
    ) {
        throw new ProviderError("zoom_url");
    }
    return $url;
}
function createZoom(array $u, string $classId, string $host = ""): array
{
    $c = one("SELECT * FROM classes WHERE id=?", [$classId]);
    if (!$c) {
        fail(404, "الحصة غير موجودة.");
    }
    courseAccess($u, $c["course_id"], true);
    $config = requireIntegration("zoom");
    // Only administrators can select another host in the center account.
    if ($u["role"] !== "admin") {
        $host = $u["email"];
    } elseif (!$host) {
        $host = (string) ($config["default_host"] ?? "");
    }
    if (!$host) {
        fail(422, "حدد بريد مضيف زوم المعتمد في حساب المركز.");
    }
    $host = email($host);
    $existing = tx(function () use ($classId, $host) {
        lockRow("classes", $classId);
        $old = one("SELECT * FROM zoom_meetings WHERE class_id=?", [$classId]);
        if ($old) {
            return $old;
        }
        run(
            "INSERT INTO zoom_meetings(class_id,host_id,status,created_at,updated_at) VALUES(?,?,'creating',?,?)",
            [$classId, $host, now(), now()],
        );
        return null;
    });
    if ($existing) {
        if ($existing["status"] === "ready") {
            return ["ok" => true];
        }
        fail(409, "طلب زوم موجود ويحتاج مراجعة حالته قبل إعادة الإنشاء.");
    }
    try {
        $r = zoomRequest(
            "POST",
            "/users/" . rawurlencode($host) . "/meetings",
            [
                "topic" => $c["title"],
                "type" => 2,
                "start_time" => $c["starts_at"],
                "duration" => max(
                    1,
                    (int) ceil(
                        (strtotime($c["ends_at"]) -
                            strtotime($c["starts_at"])) /
                            60,
                    ),
                ),
                "timezone" => "Asia/Riyadh",
                "password" => substr(bin2hex(random_bytes(6)), 0, 10),
                "settings" => [
                    "waiting_room" => true,
                    "join_before_host" => false,
                    "mute_upon_entry" => true,
                    "participant_video" => false,
                    "host_video" => false,
                    "use_pmi" => false,
                    "auto_recording" => "none",
                ],
            ],
        );
        $mid = (string) ($r["id"] ?? "");
        if (!preg_match('/^[0-9]{9,12}$/', $mid)) {
            throw new ProviderError("zoom_meeting_id", true);
        }
        $join = validZoomUrl($r["join_url"] ?? "");
        run(
            "UPDATE zoom_meetings SET meeting_id=?,join_url=?,status='ready',updated_at=? WHERE class_id=?",
            [$mid, enc($join), now(), $classId],
        );
        audit($u, "zoom.created", $classId);
    } catch (ProviderError $e) {
        run(
            "UPDATE zoom_meetings SET status=?,last_error=?,updated_at=? WHERE class_id=?",
            [
                $e->uncertain ? "uncertain" : "failed",
                $e->reason,
                now(),
                $classId,
            ],
        );
        throw $e;
    }
    return ["ok" => true];
}
function zoomLink(array $u, string $id, bool $host = false): array
{
    $c = one("SELECT * FROM classes WHERE id=?", [$id]);
    if (!$c) {
        fail(404, "الحصة غير موجودة.");
    }
    courseAccess($u, $c["course_id"], $host);
    if ($u["role"] === "guardian") {
        fail(403, "الدخول للقاء متاح للطالب من حسابه.");
    }
    $z = one(
        "SELECT * FROM zoom_meetings WHERE class_id=? AND status='ready'",
        [$id],
    );
    if (!$z) {
        fail(404, "لقاء زوم لم يُجهّز بعد.");
    }
    if (
        time() < strtotime($c["starts_at"]) - 1800 ||
        time() > strtotime($c["ends_at"]) + 3600
    ) {
        fail(409, "يفتح اللقاء قبل موعده بنصف ساعة وحتى ساعة بعد نهايته.");
    }
    if ($host) {
        $r = zoomRequest("GET", "/meetings/" . rawurlencode($z["meeting_id"]));
        $url = validZoomUrl($r["start_url"] ?? "");
    } else {
        $url = validZoomUrl(dec($z["join_url"]));
    }
    audit($u, $host ? "zoom.host_opened" : "zoom.join_opened", $id);
    return ["url" => $url];
}
function zoomWebhook(string $raw, array $data): array
{
    $config = requireIntegration("zoom");
    $timestamp = $_SERVER["HTTP_X_ZM_REQUEST_TIMESTAMP"] ?? "";
    if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
        fail(403, "توقيع زوم منتهي أو غير صحيح.");
    }
    $expected =
        "v0=" .
        hash_hmac(
            "sha256",
            "v0:" . $timestamp . ":" . $raw,
            $config["webhook_secret"],
        );
    if (!hash_equals($expected, $_SERVER["HTTP_X_ZM_SIGNATURE"] ?? "")) {
        fail(403, "توقيع زوم غير صحيح.");
    }
    if (($data["event"] ?? "") === "endpoint.url_validation") {
        $plain = $data["payload"]["plainToken"] ?? "";
        if (!is_string($plain) || strlen($plain) > 500) {
            fail(422, "طلب غير صحيح.");
        }
        return [
            "plainToken" => $plain,
            "encryptedToken" => hash_hmac(
                "sha256",
                $plain,
                $config["webhook_secret"],
            ),
        ];
    }
    $event = $data["event"] ?? "";
    if (
        !in_array(
            $event,
            [
                "meeting.participant_joined",
                "meeting.participant_left",
                "meeting.started",
                "meeting.ended",
            ],
            true,
        )
    ) {
        return ["ok" => true];
    }
    $object = $data["payload"]["object"] ?? [];
    $z = one("SELECT class_id FROM zoom_meetings WHERE meeting_id=?", [
        (string) ($object["id"] ?? ""),
    ]);
    if (!$z) {
        return ["ok" => true];
    }
    $key = hash("sha256", "zoom:" . $raw);
    return tx(function () use ($key, $event, $object, $z) {
        lockRow("classes", $z["class_id"]);
        if (one("SELECT id FROM provider_events WHERE id=?", [$key])) {
            return ["ok" => true];
        }
        run(
            "INSERT INTO provider_events(id,provider,event_type,entity_id,created_at) VALUES(?,?,?,?,?)",
            [$key, "zoom", $event, $z["class_id"], now()],
        );
        if (
            in_array(
                $event,
                ["meeting.participant_joined", "meeting.participant_left"],
                true,
            )
        ) {
            $p = $object["participant"] ?? [];
            $mail = strtolower(
                trim((string) ($p["email"] ?? ($p["user_email"] ?? ""))),
            );
            // Unverified display names and missing emails are never matched to students.
            $student = $mail
                ? one(
                    "SELECT u.id FROM users u JOIN enrollments e ON e.student_id=u.id JOIN classes c ON c.course_id=e.course_id WHERE c.id=? AND u.email=? AND u.role='student' AND u.active=1",
                    [$z["class_id"], $mail],
                )
                : null;
            if ($student) {
                if ($event === "meeting.participant_joined") {
                    $joined = dateInput($p["join_time"] ?? now());
                    $pid = hash(
                        "sha256",
                        $z["class_id"] . ":" . $student["id"] . ":" . $joined,
                    );
                    if (
                        !one("SELECT id FROM zoom_presence WHERE id=?", [$pid])
                    ) {
                        run(
                            "INSERT INTO zoom_presence(id,class_id,student_id,joined_at,source) VALUES(?,?,?,?,?)",
                            [
                                $pid,
                                $z["class_id"],
                                $student["id"],
                                $joined,
                                "zoom_webhook",
                            ],
                        );
                    }
                } else {
                    $left = dateInput($p["leave_time"] ?? now());
                    run(
                        "UPDATE zoom_presence SET left_at=? WHERE class_id=? AND student_id=? AND left_at IS NULL AND joined_at<=?",
                        [$left, $z["class_id"], $student["id"], $left],
                    );
                }
            }
        }
        return ["ok" => true];
    });
}
