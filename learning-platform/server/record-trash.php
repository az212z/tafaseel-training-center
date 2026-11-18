<?php
declare(strict_types=1);

function trashTables(): array
{
    return [
        "lesson" => "lessons",
        "quiz" => "quizzes",
        "assignment" => "assignments",
        "class" => "classes",
        "file" => "files",
        "announcement" => "announcements",
        "course" => "courses",
        "account" => "users",
        "bag" => "learning_bags",
        "path" => "learning_paths",
        "video" => "video_assets",
        "certificate" => "certificates",
        "support" => "support",
    ];
}

function recordAvailable(string $kind, string $column): string
{
    if (
        !isset(trashTables()[$kind]) ||
        !preg_match('/^[a-z_]+\.[a-z_]+$/D', $column)
    ) {
        throw new LogicException("Invalid archive query.");
    }
    return "NOT EXISTS (SELECT 1 FROM record_trash x WHERE x.kind='$kind' AND x.resource_id=$column)";
}

function guardActiveRecord(string $kind, string $id): void
{
    if (
        one(
            "SELECT resource_id FROM record_trash WHERE kind=? AND resource_id=?",
            [$kind, $id],
        )
    ) {
        fail(404, "هذا العنصر نُقل إلى سلة المحذوفات.");
    }
}

function recordTrashAction(string $action, string $method, array $d): ?array
{
    if (
        !in_array(
            $action,
            ["trash.list", "trash.remove", "trash.restore"],
            true,
        )
    ) {
        return null;
    }
    if ($method !== ($action === "trash.list" ? "GET" : "POST")) {
        fail(405, "طريقة الطلب غير مسموحة.");
    }
    $u = auth($action === "trash.remove" ? ["admin", "instructor"] : ["admin"]);
    staffMfaGuard($u, $action);
    if ($action === "trash.list") {
        return pagedList(
            "SELECT * FROM record_trash ORDER BY removed_at DESC,kind,resource_id",
            "SELECT COUNT(*) n FROM record_trash",
            [],
            number($d["page"] ?? 1, 1, 1000000),
        );
    }
    csrf();
    $id = str($d["id"] ?? "", 40);
    $kind = str($d["kind"] ?? "", 20);
    $table = trashTables()[$kind] ?? null;
    if (!$table) {
        fail(422, "هذا النوع غير مدعوم.");
    }
    return tx(function () use ($u, $id, $kind, $table, $action) {
        $row = one("SELECT * FROM $table WHERE id=?", [$id]);
        if (!$row) {
            fail(404, "العنصر غير موجود.");
        }
        $course = $kind === "course" ? $id : $row["course_id"] ?? null;
        if ($course) {
            lockRow("courses", $course);
        }
        if ($kind === "account") {
            lockRow("users", $id);
        }
        $row = one(
            "SELECT * FROM $table WHERE id=?" .
                (db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql"
                    ? " FOR UPDATE"
                    : ""),
            [$id],
        );
        if ($u["role"] === "instructor") {
            if (
                !$course ||
                in_array($kind, ["course", "certificate"], true) ||
                ($kind === "file" && $row["purpose"] !== "resource")
            ) {
                fail(403, "هذا الإجراء من صلاحية الإدارة.");
            }
            courseAccess($u, $course, true);
        }
        $existing = one(
            "SELECT previous_state FROM record_trash WHERE kind=? AND resource_id=?",
            [$kind, $id],
        );
        if ($action === "trash.restore") {
            if ($existing) {
                if ($kind === "course" || $kind === "path") {
                    run("UPDATE $table SET status=? WHERE id=?", [
                        $existing["previous_state"],
                        $id,
                    ]);
                } elseif ($kind === "account") {
                    run(
                        "UPDATE users SET active=?,auth_version=auth_version+1 WHERE id=?",
                        [(int) $existing["previous_state"], $id],
                    );
                }
                run("DELETE FROM record_trash WHERE kind=? AND resource_id=?", [
                    $kind,
                    $id,
                ]);
                audit($u, "trash.restored." . $kind, $id);
            }
            return ["ok" => true];
        }
        if ($existing) {
            return ["ok" => true];
        }
        $previous = null;
        if ($kind === "account") {
            $owner =
                setting("admin_login", [])["user_id"] ??
                one(
                    "SELECT id FROM users WHERE role='admin' ORDER BY created_at,id LIMIT 1",
                )["id"];
            if (
                $id === $owner ||
                $id === $u["id"] ||
                ($row["role"] === "admin" && $u["id"] !== $owner)
            ) {
                fail(403, "لا يمكنك حذف هذا الحساب الإداري.");
            }
            $previous = (string) $row["active"];
            run(
                "UPDATE users SET active=0,auth_version=auth_version+1 WHERE id=?",
                [$id],
            );
        } elseif ($kind === "course" || $kind === "path") {
            $previous = $row["status"];
            run("UPDATE $table SET status='archived' WHERE id=?", [$id]);
        } elseif ($kind === "video" && $row["lesson_id"]) {
            fail(409, "الفيديو مرتبط بدرس. افصله عن الدرس أولًا.");
        } elseif ($kind === "file") {
            if (
                one("SELECT id FROM lessons WHERE file_id=? LIMIT 1", [$id]) ||
                one("SELECT id FROM submissions WHERE file_id=? LIMIT 1", [
                    $id,
                ]) ||
                one("SELECT id FROM bag_items WHERE file_id=? LIMIT 1", [$id])
            ) {
                fail(409, "الملف مرتبط بمحتوى تدريبي. افصل المرفق أولاً.");
            }
        } elseif ($kind === "class") {
            run(
                "UPDATE notification_outbox SET status='cancelled',updated_at=? WHERE class_id=? AND status IN ('pending','retry','blocked')",
                [now(), $id],
            );
        }
        if ($kind === "course") {
            run(
                "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE course_id=? AND status IN ('pending','retry','blocked')",
                [now(), $id],
            );
        } elseif ($kind === "class") {
            run(
                "UPDATE email_outbox SET status='cancelled',updated_at=? WHERE resource_id=? AND status IN ('pending','retry','blocked')",
                [now(), $id],
            );
        }
        run(
            "INSERT INTO record_trash(kind,resource_id,course_id,title,previous_state,removed_by,removed_at) VALUES(?,?,?,?,?,?,?)",
            [
                $kind,
                $id,
                $course,
                $row["title"] ??
                ($row["name"] ?? ($row["serial"] ?? ($row["subject"] ?? $id))),
                $previous,
                $u["id"],
                now(),
            ],
        );
        audit($u, "trash.removed." . $kind, $id);
        return ["ok" => true];
    });
}
