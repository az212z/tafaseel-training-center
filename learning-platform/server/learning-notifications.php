<?php
declare(strict_types=1);

function courseUpdate(
    string $course,
    string $kind,
    string $resource,
    string $title,
    string $path,
): void {
    $c = one("SELECT title,status FROM courses WHERE id=?", [$course]);
    if (!$c || $c["status"] !== "published") {
        return;
    }
    $insert =
        "INSERT INTO learning_updates(id,event_key,course_id,kind,title,body,link_path,created_at) VALUES(?,?,?,?,?,?,?,?)";
    $insert .=
        db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql"
            ? " ON DUPLICATE KEY UPDATE event_key=event_key"
            : " ON CONFLICT(event_key) DO NOTHING";
    run($insert, [
        uid(),
        $kind . ":" . $resource,
        $course,
        $kind,
        $title,
        $c["title"],
        $path,
        now(),
    ]);
}

function learningUpdateScope(array $u): array
{
    if ($u["role"] !== "student") {
        fail(403, "تحديثات التعلم متاحة للطالب من حسابه.");
    }
    return [
        " FROM learning_updates n JOIN courses c ON c.id=n.course_id AND c.status='published' JOIN enrollments e ON e.course_id=n.course_id AND e.student_id=? AND e.created_at<=n.created_at AND NOT EXISTS (SELECT 1 FROM record_trash t WHERE t.kind=n.kind AND t.resource_id=SUBSTR(n.event_key,LENGTH(n.kind)+2)) LEFT JOIN learning_update_reads r ON r.update_id=n.id AND r.user_id=e.student_id",
        [$u["id"]],
    ];
}

function learningUpdates(array $u, int $page): array
{
    [$from, $args] = learningUpdateScope($u);
    $counts = one(
        "SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN r.read_at IS NULL THEN 1 ELSE 0 END),0) unread" .
            $from,
        $args,
    );
    return [
        "items" => rows(
            "SELECT n.id,n.course_id,n.kind,n.title,n.body,n.link_path,n.created_at,r.read_at" .
                $from .
                " ORDER BY n.created_at DESC,n.id DESC LIMIT 25 OFFSET " .
                ($page - 1) * 25,
            $args,
        ),
        "total" => (int) $counts["total"],
        "unread" => (int) $counts["unread"],
        "page" => $page,
        "page_size" => 25,
    ];
}

function readLearningUpdates(array $u, array $d): array
{
    [$from, $args] = learningUpdateScope($u);
    $all = ($d["all"] ?? false) === true;
    $where = " WHERE r.read_at IS NULL";
    if (!$all) {
        $id = str($d["id"] ?? "", 40);
        if (!one("SELECT n.id" . $from . " WHERE n.id=?", [...$args, $id])) {
            fail(404, "الإشعار غير متاح.");
        }
        $where .= " AND n.id=?";
        $args[] = $id;
    }
    $sql =
        "INSERT INTO learning_update_reads(update_id,user_id,read_at) SELECT n.id,?,?" .
        $from .
        $where;
    $sql .=
        db()->getAttribute(PDO::ATTR_DRIVER_NAME) === "mysql"
            ? " ON DUPLICATE KEY UPDATE read_at=learning_update_reads.read_at"
            : " ON CONFLICT(update_id,user_id) DO NOTHING";
    run($sql, [$u["id"], now(), ...$args]);
    return ["ok" => true];
}
