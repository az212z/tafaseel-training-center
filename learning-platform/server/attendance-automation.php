<?php
declare(strict_types=1);

function attendanceAutomationMode(mixed $mode): string
{
    if (!in_array($mode, ["manual", "zoom"], true)) {
        fail(422, "اختر رصد المعلم أو الحضور من زوم.");
    }
    if ($mode === "zoom" && !integrationEnabled("zoom")) {
        fail(422, "يجب ربط حساب زوم قبل تفعيل الرصد التلقائي منه.");
    }
    return $mode;
}

function attendanceAutomationCreate(string $class, string $mode): void
{
    run(
        "INSERT INTO class_attendance_automation(class_id,mode,created_at) VALUES(?,?,?)",
        [$class, $mode, now()],
    );
}

function attendanceAutomationControl(array $u, array $d): array
{
    $class = one(
        "SELECT * FROM classes k WHERE id=? AND " .
            recordAvailable("class", "k.id"),
        [str($d["class_id"] ?? "", 40)],
    );
    if (!$class) {
        fail(404, "الحصة غير موجودة.");
    }
    courseAccess($u, $class["course_id"], true);
    $command = $d["command"] ?? "";
    if (!in_array($command, ["start", "pause"], true)) {
        fail(422, "الإجراء غير صحيح.");
    }
    $mode =
        $command === "start"
            ? attendanceAutomationMode($d["mode"] ?? "manual")
            : "manual";
    if (
        $command === "start" &&
        (time() < strtotime($class["starts_at"]) - 900 ||
            time() >= strtotime($class["ends_at"]))
    ) {
        fail(422, "يُفتح رصد الحضور قبل الحصة بربع ساعة وحتى نهايتها.");
    }
    if (
        $command === "start" &&
        strtotime($class["ends_at"]) <
            max(time(), strtotime($class["starts_at"])) + 1200
    ) {
        fail(422, "يجب أن يتبقى في الحصة ٢٠ دقيقة على الأقل لبدء المهلة.");
    }
    return tx(function () use ($u, $class, $command, $mode) {
        lockRow("classes", $class["id"]);
        $old = one(
            "SELECT * FROM class_attendance_automation WHERE class_id=?",
            [$class["id"]],
        );
        if (!$old) {
            attendanceAutomationCreate($class["id"], $mode);
        }
        if ($command === "pause") {
            run(
                "UPDATE class_attendance_automation SET enabled=0 WHERE class_id=?",
                [$class["id"]],
            );
            run(
                "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE class_id=? AND kind='absence_auto' AND status IN ('pending','retry','blocked')",
                [now(), $class["id"]],
            );
        } else {
            if (
                $mode === "zoom" &&
                !one(
                    "SELECT class_id FROM zoom_meetings WHERE class_id=? AND status='ready'",
                    [$class["id"]],
                )
            ) {
                fail(422, "جهّز لقاء زوم المرتبط بهذه الحصة أولًا.");
            }
            // Repeated clicks never reset an active twenty-minute grace period.
            $start =
                $old && $old["enabled"] && $old["mode"] === $mode
                    ? $old["started_at"]
                    : null;
            if ($mode === "manual" && !$start) {
                $start = gmdate(
                    "Y-m-d\TH:i:s\Z",
                    max(time(), strtotime($class["starts_at"])),
                );
            }
            run(
                "UPDATE class_attendance_automation SET mode=?,enabled=1,started_at=?,started_by=?,closed_at=NULL,needs_review=0 WHERE class_id=?",
                [$mode, $start, $u["id"], $class["id"]],
            );
        }
        audit($u, "attendance.automation_" . $command, $class["id"]);
        return ["ok" => true];
    });
}

function automationClassDetails(array &$classes, bool $staff): void
{
    if (!$classes) {
        return;
    }
    $ids = array_column($classes, "id");
    $rules = array_column(
        rows(
            "SELECT * FROM class_attendance_automation WHERE class_id IN (" .
                implode(",", array_fill(0, count($ids), "?")) .
                ")",
            $ids,
        ),
        null,
        "class_id",
    );
    foreach ($classes as &$class) {
        $rule = $rules[$class["id"]] ?? null;
        $class["attendance_automation"] = $rule
            ? [
                "enabled" => (bool) $rule["enabled"],
                "mode" => $rule["mode"],
                "started_at" => $rule["started_at"],
                "deadline" => $rule["started_at"]
                    ? gmdate(
                        "Y-m-d\TH:i:s\Z",
                        strtotime($rule["started_at"]) + 1200,
                    )
                    : null,
                "grace_minutes" => 20,
            ]
            : null;
        if ($staff && $rule) {
            $class["attendance_automation"]["needs_review"] =
                (bool) $rule["needs_review"];
        }
    }
}

function automaticAbsences(int $limit = 100, ?float $deadline = null): array
{
    $result = ["classes" => 0, "absent" => 0, "needs_review" => 0];
    $cutoff = gmdate("Y-m-d\TH:i:s\Z", time() - 1200);
    $oldestEnd = gmdate("Y-m-d\TH:i:s\Z", time() - 3600);
    $classes = rows(
        "SELECT k.id FROM classes k JOIN courses c ON c.id=k.course_id AND c.status='published' JOIN class_attendance_automation a ON a.class_id=k.id WHERE " .
            recordAvailable("class", "k.id") .
            " AND a.enabled=1 AND a.started_at IS NOT NULL AND a.started_at<=? AND k.ends_at>=? ORDER BY a.checked_at,a.started_at LIMIT " .
            max(1, min(100, $limit)),
        [$cutoff, $oldestEnd],
    );
    foreach ($classes as $item) {
        if ($deadline !== null && microtime(true) >= $deadline) {
            break;
        }
        $counts = tx(function () use ($item, $cutoff) {
            lockRow("classes", $item["id"]);
            $class = one(
                "SELECT k.*,c.instructor_id,c.status course_status FROM classes k JOIN courses c ON c.id=k.course_id WHERE k.id=?",
                [$item["id"]],
            );
            $rule = one(
                "SELECT * FROM class_attendance_automation WHERE class_id=?",
                [$item["id"]],
            );
            if (
                !$rule ||
                !$rule["enabled"] ||
                !$rule["started_at"] ||
                $rule["started_at"] > $cutoff ||
                $class["course_status"] !== "published"
            ) {
                return [0, 0];
            }
            $deadline = gmdate(
                "Y-m-d\TH:i:s\Z",
                strtotime($rule["started_at"]) + 1200,
            );
            run(
                "UPDATE class_attendance_automation SET checked_at=? WHERE class_id=?",
                [now(), $class["id"]],
            );
            if (
                $class["ends_at"] < $deadline ||
                ($rule["closed_at"] && $rule["closed_at"] < $deadline)
            ) {
                return [0, 0];
            }
            if (
                $rule["needs_review"] ||
                ($rule["mode"] === "zoom" && !integrationEnabled("zoom"))
            ) {
                return [0, 1];
            }
            $actor = $rule["started_by"] ?: $class["instructor_id"];
            if (!$actor) {
                return [0, 1];
            }
            $missing = rows(
                "SELECT u.id FROM users u JOIN enrollments e ON e.student_id=u.id AND e.course_id=? AND e.created_at<=? LEFT JOIN attendance a ON a.class_id=? AND a.student_id=u.id WHERE u.role='student' AND u.active=1 AND a.id IS NULL",
                [$class["course_id"], $rule["started_at"], $class["id"]],
            );
            $count = 0;
            foreach ($missing as $student) {
                if (
                    one(
                        "SELECT id FROM zoom_presence WHERE class_id=? AND student_id=? AND joined_at<=?",
                        [$class["id"], $student["id"], now()],
                    )
                ) {
                    continue;
                }
                $id = uid();
                run(
                    "INSERT INTO attendance(id,class_id,student_id,status,note,recorded_by,updated_at) VALUES(?,?,?,'absent',?,?,?)",
                    [
                        $id,
                        $class["id"],
                        $student["id"],
                        "غياب تلقائي بعد انتهاء مهلة الحضور (٢٠ دقيقة).",
                        $actor,
                        now(),
                    ],
                );
                run(
                    "INSERT INTO class_automatic_absences(class_id,student_id,attendance_id,created_at) VALUES(?,?,?,?)",
                    [$class["id"], $student["id"], $id, now()],
                );
                syncAbsenceNotice($class["id"], $student["id"], "absent", true);
                $count++;
            }
            if ($count) {
                audit(null, "attendance.auto_absent", $class["id"]);
            }
            return [$count, 0];
        });
        $result["classes"]++;
        $result["absent"] += $counts[0];
        $result["needs_review"] += $counts[1];
    }
    return $result;
}

function automationZoomEvent(
    array $class,
    array $meeting,
    string $event,
    array $object,
    ?array $student,
): void {
    $rule = one("SELECT * FROM class_attendance_automation WHERE class_id=?", [
        $class["id"],
    ]);
    if (!$rule || !$rule["enabled"] || $rule["mode"] !== "zoom") {
        return;
    }
    if ($event === "meeting.started") {
        if (!$rule["started_at"]) {
            $start = gmdate(
                "Y-m-d\TH:i:s\Z",
                max(
                    strtotime(dateInput($object["start_time"] ?? now())),
                    strtotime($class["starts_at"]),
                ),
            );
            $course = one("SELECT instructor_id FROM courses WHERE id=?", [
                $class["course_id"],
            ]);
            run(
                "UPDATE class_attendance_automation SET started_at=?,started_by=COALESCE(started_by,?) WHERE class_id=?",
                [$start, $course["instructor_id"], $class["id"]],
            );
        }
    } elseif ($event === "meeting.ended") {
        run(
            "UPDATE class_attendance_automation SET closed_at=? WHERE class_id=?",
            [dateInput($object["end_time"] ?? now()), $class["id"]],
        );
    } elseif ($event === "meeting.participant_joined") {
        $participant = $object["participant"] ?? [];
        if (!$student) {
            $mail = strtolower(
                trim(
                    (string) ($participant["email"] ??
                        ($participant["user_email"] ?? "")),
                ),
            );
            $host =
                ($mail && $mail === strtolower($meeting["host_id"])) ||
                (!empty($object["host_id"]) &&
                    ($participant["id"] ?? "") === $object["host_id"]);
            if (!$host) {
                run(
                    "UPDATE class_attendance_automation SET needs_review=1 WHERE class_id=?",
                    [$class["id"]],
                );
            }
            return;
        }
        $old = one(
            "SELECT id,status FROM attendance WHERE class_id=? AND student_id=?",
            [$class["id"], $student["id"]],
        );
        $automatic = one(
            "SELECT attendance_id FROM class_automatic_absences WHERE class_id=? AND student_id=?",
            [$class["id"], $student["id"]],
        );
        if ($old && !$automatic) {
            return;
        }
        $joined = dateInput($participant["join_time"] ?? now());
        $start = $rule["started_at"] ?: $class["starts_at"];
        $status =
            strtotime($joined) <= strtotime($start) + 1200 ? "present" : "late";
        $actor =
            $rule["started_by"] ?:
            one("SELECT instructor_id FROM courses WHERE id=?", [
                $class["course_id"],
            ])["instructor_id"];
        if (!$actor) {
            return;
        }
        if ($old) {
            run(
                "UPDATE attendance SET status=?,note=?,recorded_by=?,updated_at=? WHERE id=?",
                [
                    $status,
                    "حضور مؤكد من إشعار زوم المرتبط بحساب الطالب.",
                    $actor,
                    now(),
                    $old["id"],
                ],
            );
        } else {
            run(
                "INSERT INTO attendance(id,class_id,student_id,status,note,recorded_by,updated_at) VALUES(?,?,?,?,?,?,?)",
                [
                    uid(),
                    $class["id"],
                    $student["id"],
                    $status,
                    "حضور مؤكد من إشعار زوم المرتبط بحساب الطالب.",
                    $actor,
                    now(),
                ],
            );
        }
        run(
            "DELETE FROM class_automatic_absences WHERE class_id=? AND student_id=?",
            [$class["id"], $student["id"]],
        );
        syncAbsenceNotice($class["id"], $student["id"], $status);
    }
}
