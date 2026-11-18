<?php
declare(strict_types=1);
function zoomToken(bool $refresh = false): string
{
    $c = requireIntegration("zoom");
    $cached = setting("zoom_token");
    if (!$refresh && $cached && ($cached["expires"] ?? 0) > time() + 90) {
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
    $c = one(
        "SELECT * FROM classes k WHERE id=? AND " .
            recordAvailable("class", "k.id"),
        [$classId],
    );
    if (!$c) {
        fail(404, "الحصة غير موجودة.");
    }
    courseAccess($u, $c["course_id"], true);
    $config = requireIntegration("zoom");
    if ($u["role"] !== "admin" || !$host) {
        $host = (string) ($config["default_host"] ?? "");
    }
    if (!$host) {
        fail(422, "يلزم تعيين مضيف زوم من إدارة المركز.");
    }
    $host = email($host);
    $existing = tx(function () use ($classId, $host) {
        lockRow("classes", $classId);
        $old = one("SELECT * FROM zoom_meetings WHERE class_id=?", [$classId]);
        if ($old) {
            if ($old["status"] === "failed" && !$old["meeting_id"]) {
                run(
                    "UPDATE zoom_meetings SET host_id=?,status='creating',last_error=NULL,updated_at=? WHERE class_id=?",
                    [$host, now(), $classId],
                );
                return null;
            }
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
        try {
            $join = validZoomUrl($r["join_url"] ?? "");
        } catch (ProviderError) {
            throw new ProviderError("zoom_join_url", true);
        }
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
        fail(
            502,
            $e->uncertain
                ? "لم يؤكد زوم حالة اللقاء. راجع إدارة المركز قبل إعادة المحاولة."
                : "رفض زوم إنشاء اللقاء. أعد المحاولة، وإذا تكرر الخطأ تواصل مع الإدارة للتحقق من الحساب المضيف.",
        );
    }
    return ["ok" => true];
}
function zoomSession(array $u, string $id, bool $host): array
{
    $c = one(
        "SELECT * FROM classes k WHERE id=? AND " .
            recordAvailable("class", "k.id"),
        [$id],
    );
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
    if (time() < strtotime($c["starts_at"]) - 1800) {
        fail(409, "يفتح رابط الحصة قبل موعدها بنصف ساعة.");
    }
    if (time() > strtotime($c["ends_at"]) + 3600) {
        fail(409, "انتهت الحصة وأُغلق رابطها.");
    }
    return [$c, $z];
}

function zoomMeetingDetails(string $meetingId): array
{
    $path = "/meetings/" . rawurlencode($meetingId);
    try {
        return zoomRequest("GET", $path);
    } catch (ProviderError $error) {
        if ($error->reason !== "http_401") {
            throw $error;
        }
        return providerRequest("zoom", "GET", $path, null, [
            "Authorization: Bearer " . zoomToken(true),
        ]);
    }
}

function zoomLink(array $u, string $id, bool $host = false): array
{
    [, $z] = zoomSession($u, $id, $host);
    try {
        $url = $host
            ? validZoomUrl(zoomMeetingDetails($z["meeting_id"])["start_url"] ?? "")
            : validZoomUrl(dec($z["join_url"]));
    } catch (ProviderError $error) {
        audit($u, "zoom.link_unavailable", $id);
        if ($host && $error->reason === "http_404") {
            fail(502, "لم يجد زوم اللقاء في حساب المركز. راجع إدارة المركز للتحقق من اللقاء قبل تجهيز بديل.");
        }
        fail(502, $host
            ? "تعذّر فتح رابط المضيف. حاول مجددًا، وإذا تكرر الخطأ تواصل مع إدارة المركز."
            : "رابط الحصة غير متاح حاليًا. تواصل مع المدرب.");
    }
    audit($u, $host ? "zoom.host_opened" : "zoom.join_opened", $id);
    return ["url" => $url];
}

function zoomEmbedConfigured(): bool
{
    $config = integrationConfig("zoom");
    return integrationEnabled("zoom") &&
        !empty($config["sdk_client_id"]) && !empty($config["sdk_client_secret"]);
}

function zoomEmbedSignature(string $meeting, bool $host, array $config): string
{
    $encode = fn(string $value): string => rtrim(strtr(base64_encode($value), "+/", "-_"), "=");
    $issued = time() - 30;
    $expires = $issued + 1800;
    $header = $encode('{"alg":"HS256","typ":"JWT"}');
    $payload = $encode(json_encode([
        "appKey" => $config["sdk_client_id"],
        "mn" => $meeting,
        "role" => $host ? 1 : 0,
        "iat" => $issued,
        "exp" => $expires,
        "tokenExp" => $expires,
    ], JSON_THROW_ON_ERROR));
    return "$header.$payload." . $encode(hash_hmac("sha256", "$header.$payload",
        $config["sdk_client_secret"], true));
}

function zoomStudentKey(string $class, string $student): string
{
    return "tf" . substr(hash_hmac("sha256", "zoom-student:$class:$student", cfg()["key"]), 0, 32);
}

function zoomEmbed(array $u, string $id, bool $host): array
{
    [$class, $meeting] = zoomSession($u, $id, $host);
    if (!zoomEmbedConfigured()) {
        fail(409, "الحصة داخل تفاصيل تحتاج تفعيل البث من الإدارة.");
    }
    rate("zoom-embed:" . $u["id"] . ":" . $id, 12, 300);
    $number = $meeting["meeting_id"];
    try {
        $details = zoomMeetingDetails($number);
        $zak = "";
        if ($host) {
            $startUrl = validZoomUrl($details["start_url"] ?? "");
            parse_str(parse_url($startUrl, PHP_URL_QUERY) ?? "", $query);
            $zak = $query["zak"] ?? "";
            if (!is_string($zak) || $zak === "") {
                throw new ProviderError("zoom_host_credential");
            }
        }
    } catch (ProviderError) {
        audit($u, "zoom.embed_unavailable", $id);
        fail(502, "تعذّر فتح الحصة داخل تفاصيل. حاول مجددًا أو تواصل مع المركز.");
    }
    $passcode = $details["password"] ?? "";
    if (!is_string($passcode)) {
        fail(502, "تعذّر قراءة رمز دخول الحصة من زوم.");
    }
    audit($u, $host ? "zoom.embed_host_requested" : "zoom.embed_join_requested", $id);
    return [
        "title" => $class["title"],
        "course_id" => $class["course_id"],
        "meetingNumber" => $number,
        "signature" => zoomEmbedSignature($number, $host, integrationConfig("zoom")),
        "passWord" => $passcode,
        "userName" => $u["name"],
        ...($host ? ["zak" => $zak] : []),
        ...($u["role"] === "student" ? ["customerKey" => zoomStudentKey($id, $u["id"])] : []),
    ];
}

function zoomParticipantStudent(string $class, array $participant): ?array
{
    $roster = "SELECT u.id FROM users u JOIN enrollments e ON e.student_id=u.id JOIN classes c ON c.course_id=e.course_id WHERE c.id=? AND u.role='student' AND u.active=1";
    $key = $participant["customer_key"] ?? "";
    if (is_string($key) && str_starts_with($key, "tf")) {
        if (!preg_match('/^tf[a-f0-9]{32}$/D', $key)) {
            return null;
        }
        foreach (rows($roster, [$class]) as $student) {
            if (hash_equals(zoomStudentKey($class, $student["id"]), $key)) {
                return $student;
            }
        }
        return null;
    }
    $mail = strtolower(trim((string) ($participant["email"] ?? ($participant["user_email"] ?? ""))));
    return $mail ? one($roster . " AND u.email=?", [$class, $mail]) : null;
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
    $z = one("SELECT class_id,host_id FROM zoom_meetings WHERE meeting_id=?", [
        (string) ($object["id"] ?? ""),
    ]);
    if (!$z) {
        return ["ok" => true];
    }
    $key = hash("sha256", "zoom:" . $raw);
    return tx(function () use ($key, $event, $object, $z) {
        lockRow("classes", $z["class_id"]);
        $class = one(
            "SELECT k.* FROM classes k WHERE k.id=? AND " .
                recordAvailable("class", "k.id") . " AND " .
                recordAvailable("course", "k.course_id"),
            [$z["class_id"]],
        );
        if (!$class) {
            return ["ok" => true];
        }
        if (one("SELECT id FROM provider_events WHERE id=?", [$key])) {
            return ["ok" => true];
        }
        run(
            "INSERT INTO provider_events(id,provider,event_type,entity_id,created_at) VALUES(?,?,?,?,?)",
            [$key, "zoom", $event, $z["class_id"], now()],
        );
        $student = null;
        if (
            in_array(
                $event,
                ["meeting.participant_joined", "meeting.participant_left"],
                true,
            )
        ) {
            $p = $object["participant"] ?? [];
            $student = is_array($p) ? zoomParticipantStudent($z["class_id"], $p) : null;
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
                    $params = [$z["class_id"], $student["id"], $left];
                    $filter = "joined_at<=?";
                    if (!empty($p["join_time"])) {
                        $filter .= " AND joined_at=?";
                        $params[] = dateInput($p["join_time"]);
                    }
                    $presence = one(
                        "SELECT id FROM zoom_presence WHERE class_id=? AND student_id=? AND left_at IS NULL AND $filter ORDER BY joined_at DESC LIMIT 1",
                        $params,
                    );
                    if ($presence) {
                        run("UPDATE zoom_presence SET left_at=? WHERE id=?", [$left, $presence["id"]]);
                    }
                }
            }
        }
        automationZoomEvent($class, $z, $event, $object, $student);
        return ["ok" => true];
    });
}
