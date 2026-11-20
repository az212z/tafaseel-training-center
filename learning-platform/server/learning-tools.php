<?php
declare(strict_types=1);

function learningToolsAction(string $action, string $method, array $d): ?array
{
    $gets = [
        "learning.paths",
        "lesson.bookmarks",
        "discussion.list",
        "lesson.note",
        "survey",
        "training.report",
        "launch.checklist",
    ];
    $posts = [
        "path.save",
        "discussion.save",
        "discussion.status",
        "lesson.note.save",
        "survey.save",
        "enrollment.preview",
        "enrollment.batch",
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
    if ($action === "learning.paths") {
        $u = currentUser();
        if ($u) {
            staffMfaGuard($u, $action);
        }
        $admin = ($u["role"] ?? "") === "admin";
        $page = number($d["page"] ?? 1, 1, 1000000);
        $where = $admin
            ? "1=1"
            : "p.status='published' AND NOT EXISTS (SELECT 1 FROM path_courses pc JOIN courses c ON c.id=pc.course_id WHERE pc.path_id=p.id AND c.status<>'published')";
        $where .= " AND " . recordAvailable("path", "p.id");
        $out = pagedList(
            "SELECT p.* FROM learning_paths p WHERE " .
                $where .
                " ORDER BY p.updated_at DESC,p.id",
            "SELECT COUNT(*) n FROM learning_paths p WHERE " . $where,
            [],
            $page,
        );
        foreach ($out["items"] as &$path) {
            $path["courses"] = rows(
                "SELECT c.id,c.title,c.category,c.duration,pc.sort_order FROM path_courses pc JOIN courses c ON c.id=pc.course_id WHERE pc.path_id=? ORDER BY pc.sort_order",
                [$path["id"]],
            );
            $path["completed"] = [];
            if (($u["role"] ?? "") === "student") {
                $path["completed"] = array_column(
                    rows(
                        "SELECT f.course_id FROM certificates f JOIN path_courses pc ON pc.course_id=f.course_id WHERE pc.path_id=? AND f.student_id=?",
                        [$path["id"], $u["id"]],
                    ),
                    "course_id",
                );
            }
        }
        return $out;
    }
    $u = auth();
    staffMfaGuard($u, $action);
    if ($action === "lesson.bookmarks") {
        if ($u["role"] === "guardian") {
            fail(403, "دفتر المراجعة خاص بصاحب الحساب التعليمي.");
        }
        $where = "n.user_id=? AND n.bookmarked=1";
        $args = [$u["id"]];
        if ($u["role"] === "student") {
            $where .=
                " AND c.status='published' AND EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.student_id=?)";
            $args[] = $u["id"];
        } elseif ($u["role"] === "instructor") {
            $where .= " AND c.instructor_id=?";
            $args[] = $u["id"];
        }
        $from =
            " FROM lesson_notes n JOIN lessons l ON l.id=n.lesson_id JOIN courses c ON c.id=l.course_id LEFT JOIN video_assets v ON v.lesson_id=l.id WHERE " .
            $where;
        $out = pagedList(
            "SELECT l.id,l.course_id,l.title,l.kind,l.video_url," .
                visibleFileId("l.file_id") .
                ",'' body,l.duration,l.sort_order,c.title course_title,n.body note_body,n.updated_at,v.id video_asset_id,v.status video_status" .
                $from .
                " ORDER BY n.updated_at DESC,l.id",
            "SELECT COUNT(*) n" . $from,
            $args,
            number($d["page"] ?? 1, 1, 1000000),
        );
        foreach ($out["items"] as &$item) {
            $item["note_body"] = dec($item["note_body"]);
        }
        return $out;
    }
    if ($action === "path.save") {
        auth(["admin"]);
        $id = str($d["id"] ?? "", 40, false) ?: uid();
        $title = str($d["title"] ?? "", 200);
        $description = str($d["description"] ?? "", 5000);
        $level = str($d["level"] ?? "", 60);
        $goals = str($d["goals"] ?? "", 3000);
        $status = str($d["status"] ?? "draft", 20);
        if (!in_array($status, ["draft", "published", "archived"], true)) {
            fail(422, "حالة المسار غير صحيحة.");
        }
        $courses = $d["course_ids"] ?? [];
        if (
            !is_array($courses) ||
            !array_is_list($courses) ||
            count($courses) < 1 ||
            count($courses) > 50 ||
            count(array_filter($courses, "is_string")) !== count($courses) ||
            count(array_unique($courses, SORT_REGULAR)) !== count($courses)
        ) {
            fail(422, "اختر من دورة واحدة إلى ٥٠ دورة دون تكرار.");
        }
        foreach ($courses as $cid) {
            $c = courseAccess($u, str($cid, 40), true);
            if ($status === "published" && $c["status"] !== "published") {
                fail(422, "نشر المسار يتطلب نشر جميع دوراته أولًا.");
            }
        }
        tx(function () use (
            $u,
            $id,
            $title,
            $description,
            $level,
            $goals,
            $status,
            $courses,
        ) {
            lockRow("storage_locks", "files");
            if (one("SELECT id FROM learning_paths WHERE id=?", [$id])) {
                run(
                    "UPDATE learning_paths SET title=?,description=?,level=?,goals=?,status=?,updated_at=? WHERE id=?",
                    [$title, $description, $level, $goals, $status, now(), $id],
                );
            } else {
                run(
                    "INSERT INTO learning_paths(id,title,description,level,goals,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                    [
                        $id,
                        $title,
                        $description,
                        $level,
                        $goals,
                        $status,
                        now(),
                        now(),
                    ],
                );
            }
            run("DELETE FROM path_courses WHERE path_id=?", [$id]);
            foreach ($courses as $i => $cid) {
                run(
                    "INSERT INTO path_courses(path_id,course_id,sort_order) VALUES(?,?,?)",
                    [$id, $cid, $i],
                );
            }
            audit($u, "path.saved", $id);
        });
        return ["id" => $id];
    }
    if (in_array($action, ["enrollment.preview", "enrollment.batch"], true)) {
        auth(["admin"]);
        $cid = str($d["course_id"] ?? "", 40);
        $csv = str($d["csv"] ?? "", 16000);
        $lines = preg_split('/\r\n|\n|\r/', ltrim($csv, "\xEF\xBB\xBF"));
        if (count($lines) > 102) {
            fail(422, "الدفعة الواحدة لا تتجاوز ١٠٠ بريد.");
        }
        $emails = [];
        foreach ($lines as $line) {
            if (!trim($line)) {
                continue;
            }
            $cells = str_getcsv($line, ",", '"', "");
            if (count($cells) !== 1) {
                fail(422, "استخدم عمود بريد إلكتروني واحد فقط.");
            }
            if (
                in_array(
                    strtolower(trim($cells[0])),
                    ["email", "البريد الإلكتروني", "البريد"],
                    true,
                )
            ) {
                continue;
            }
            $emails[] = email(trim($cells[0]));
        }
        if (!$emails || count($emails) > 100) {
            fail(422, "أدخل من بريد واحد إلى ١٠٠ بريد.");
        }
        $unique = array_values(array_unique($emails));
        courseAccess($u, $cid, true);
        return tx(function () use ($u, $cid, $unique, $emails, $action) {
            lockRow("courses", $cid);
            $course = one("SELECT * FROM courses WHERE id=?", [$cid]);
            if ($course["status"] !== "published") {
                fail(422, "التسجيل متاح في الدورات المنشورة فقط.");
            }
            $items = [];
            $eligible = [];
            foreach ($unique as $em) {
                $s = one(
                    "SELECT id,name,active FROM users WHERE email=? AND role='student'",
                    [$em],
                );
                $status = !$s
                    ? "unknown"
                    : (!(int) $s["active"]
                        ? "inactive"
                        : (one(
                            "SELECT id FROM enrollments WHERE course_id=? AND student_id=?",
                            [$cid, $s["id"]],
                        )
                            ? "enrolled"
                            : "ready"));
                $items[] = [
                    "email" => $em,
                    "name" => $s["name"] ?? "",
                    "status" => $status,
                ];
                if ($status === "ready") {
                    $eligible[] = $s["id"];
                }
            }
            $count = (int) one(
                "SELECT COUNT(*) n FROM enrollments WHERE course_id=?",
                [$cid],
            )["n"];
            $invalid = count(
                array_filter(
                    $items,
                    fn($i) => in_array(
                        $i["status"],
                        ["unknown", "inactive"],
                        true,
                    ),
                ),
            );
            $available = max(
                0,
                (int) $course["capacity"] - $count - reservedSeats($cid),
            );
            $can = $invalid === 0 && count($eligible) <= $available;
            if ($action === "enrollment.batch") {
                if (!$can) {
                    fail(
                        409,
                        "راجع الحسابات غير النشطة أو غير الموجودة والسعة المتاحة. لم يُسجّل أي طالب.",
                    );
                }
                foreach ($eligible as $sid) {
                    run(
                        "INSERT INTO enrollments(id,course_id,student_id,created_at) VALUES(?,?,?,?)",
                        [uid(), $cid, $sid, now()],
                    );
                    emailEnrollment($cid, $sid);
                }
                audit($u, "enrollment.batch", $cid);
            }
            return [
                "items" => $items,
                "duplicates" => count($emails) - count($unique),
                "ready" => count($eligible),
                "available" => $available,
                "can_apply" => $can,
                "enrolled" =>
                    $action === "enrollment.batch" ? count($eligible) : 0,
            ];
        });
    }
    if ($action === "training.report") {
        return trainingReport($u, $d);
    }
    if ($action === "launch.checklist") {
        auth(["admin"]);
        $worker = setting("worker_last_run");
        return [
            "services" => integrationStatuses(),
            "worker_last_run" => $worker,
            "published_courses" => (int) one(
                "SELECT COUNT(*) n FROM courses WHERE status='published'",
            )["n"],
            "courses_with_content" => (int) one(
                "SELECT COUNT(*) n FROM courses c WHERE status='published' AND EXISTS(SELECT 1 FROM lessons l WHERE l.course_id=c.id)",
            )["n"],
            "pending_accounts" => (int) one(
                "SELECT COUNT(*) n FROM users WHERE role='student' AND active=0",
            )["n"],
            "review_payments" => (int) one(
                "SELECT COUNT(*) n FROM orders WHERE status IN ('uncertain','paid_review')",
            )["n"],
            "environment" => cfg()["environment"],
            "demo" => (bool) cfg()["demo"],
            "external_verification_required" => [
                "payment_live_transaction",
                "sms_delivery",
                "video_playback",
                "backup_restore",
                "hosting_load",
                "scheduled_worker",
                "uptime_alert",
            ],
        ];
    }
    if (in_array($action, ["lesson.note", "lesson.note.save"], true)) {
        if ($u["role"] === "guardian") {
            fail(403, "الملاحظات خاصة بصاحب الحساب التعليمي.");
        }
        $lid = str($d["lesson_id"] ?? "", 40);
        $lesson = one(
            "SELECT * FROM lessons l WHERE id=? AND " .
                recordAvailable("lesson", "l.id"),
            [$lid],
        );
        if (!$lesson) {
            fail(404, "الدرس غير موجود.");
        }
        courseAccess($u, $lesson["course_id"]);
        if ($action === "lesson.note.save") {
            $body = str($d["body"] ?? "", 5000, false);
            $bookmark = ($d["bookmarked"] ?? false) === true ? 1 : 0;
            $seconds = number($d["seconds"] ?? 0, 0, 86400);
            tx(function () use ($u, $lid, $body, $bookmark, $seconds) {
                lockRow(
                    "courses",
                    one(
                        "SELECT course_id FROM lessons l WHERE id=? AND " .
                            recordAvailable("lesson", "l.id"),
                        [$lid],
                    )["course_id"],
                );
                if (
                    one(
                        "SELECT user_id FROM lesson_notes WHERE user_id=? AND lesson_id=?",
                        [$u["id"], $lid],
                    )
                ) {
                    run(
                        "UPDATE lesson_notes SET body=?,bookmarked=?,seconds=?,updated_at=? WHERE user_id=? AND lesson_id=?",
                        [
                            enc($body),
                            $bookmark,
                            $seconds,
                            now(),
                            $u["id"],
                            $lid,
                        ],
                    );
                } else {
                    run(
                        "INSERT INTO lesson_notes(user_id,lesson_id,body,bookmarked,seconds,updated_at) VALUES(?,?,?,?,?,?)",
                        [
                            $u["id"],
                            $lid,
                            enc($body),
                            $bookmark,
                            $seconds,
                            now(),
                        ],
                    );
                }
            });
        }
        $note = one(
            "SELECT body,bookmarked,seconds,updated_at FROM lesson_notes WHERE user_id=? AND lesson_id=?",
            [$u["id"], $lid],
        );
        if ($note) {
            $note["body"] = dec($note["body"]);
        }
        return ["note" => $note];
    }
    if ($action === "discussion.status") {
        $id = str($d["id"] ?? "", 40);
        $thread = one(
            "SELECT * FROM discussions WHERE id=? AND parent_id IS NULL",
            [$id],
        );
        if (!$thread) {
            fail(404, "النقاش غير موجود.");
        }
        courseAccess($u, $thread["course_id"], true);
        $status = str($d["status"] ?? "", 20);
        if (!in_array($status, ["open", "resolved", "hidden"], true)) {
            fail(422, "حالة النقاش غير صحيحة.");
        }
        run("UPDATE discussions SET status=?,updated_at=? WHERE id=?", [
            $status,
            now(),
            $id,
        ]);
        audit($u, "discussion." . $status, $id);
        return ["ok" => true];
    }
    $cid = str($d["course_id"] ?? "", 40);
    courseAccess($u, $cid);
    if ($action === "discussion.list") {
        $page = number($d["page"] ?? 1, 1, 1000000);
        $parent = str($d["parent_id"] ?? "", 40, false);
        if (
            $parent &&
            !one(
                "SELECT id FROM discussions WHERE id=? AND course_id=? AND parent_id IS NULL AND status<>'hidden'",
                [$parent, $cid],
            )
        ) {
            fail(404, "النقاش غير متاح.");
        }
        $where =
            "d.course_id=? AND d.status<>'hidden' AND " .
            ($parent ? "d.parent_id=?" : "d.parent_id IS NULL");
        $args = $parent ? [$cid, $parent] : [$cid];
        return pagedList(
            "SELECT d.*,u.name author_name,u.role author_role,(SELECT COUNT(*) FROM discussions r WHERE r.parent_id=d.id) replies FROM discussions d JOIN users u ON u.id=d.author_id WHERE " .
                $where .
                " ORDER BY d.created_at,d.id",
            "SELECT COUNT(*) n FROM discussions d WHERE " . $where,
            $args,
            $page,
        );
    }
    if ($action === "discussion.save") {
        if ($u["role"] === "guardian") {
            fail(403, "المشاركة متاحة للطلاب والمدربين والإدارة.");
        }
        rate(
            "discussion:" . $u["id"],
            in_array($u["role"], ["admin", "instructor"], true) ? 120 : 20,
            600,
        );
        $body = str($d["body"] ?? "", 3000);
        $parent = str($d["parent_id"] ?? "", 40, false) ?: null;
        $title = $parent ? "" : str($d["title"] ?? "", 200);
        $id = uid();
        tx(function () use ($u, $cid, $body, $parent, $title, $id) {
            lockRow("courses", $cid);
            if (
                $parent &&
                !one(
                    "SELECT id FROM discussions WHERE id=? AND course_id=? AND parent_id IS NULL AND status='open'",
                    [$parent, $cid],
                )
            ) {
                fail(409, "النقاش مغلق أو غير متاح.");
            }
            run(
                "INSERT INTO discussions(id,course_id,author_id,parent_id,title,body,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'open',?,?)",
                [$id, $cid, $u["id"], $parent, $title, $body, now(), now()],
            );
            audit($u, "discussion.created", $id);
        });
        return ["id" => $id];
    }
    if ($action === "survey") {
        if (in_array($u["role"], ["admin", "instructor"], true)) {
            return [
                "summary" => one(
                    "SELECT COUNT(*) responses,AVG(content_rating) content_rating,AVG(trainer_rating) trainer_rating,AVG(experience_rating) experience_rating FROM course_surveys WHERE course_id=?",
                    [$cid],
                ),
            ];
        }
        if ($u["role"] !== "student") {
            fail(403, "التقييم خاص بالمتدرب.");
        }
        $row = one(
            "SELECT content_rating,trainer_rating,experience_rating,comment FROM course_surveys WHERE course_id=? AND student_id=?",
            [$cid, $u["id"]],
        );
        if ($row) {
            $row["comment"] = dec($row["comment"]);
        }
        return ["response" => $row];
    }
    if ($action === "survey.save") {
        auth(["student"]);
        $ratings = [];
        foreach (
            ["content_rating", "trainer_rating", "experience_rating"]
            as $key
        ) {
            $ratings[] = number($d[$key] ?? 0, 1, 5);
        }
        $comment = str($d["comment"] ?? "", 2000, false);
        tx(function () use ($u, $cid, $ratings, $comment) {
            lockRow("courses", $cid);
            $lessons = (int) one(
                "SELECT COUNT(*) n FROM lessons WHERE course_id=?",
                [$cid],
            )["n"];
            $done = (int) one(
                "SELECT COUNT(*) n FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.course_id=? AND p.student_id=?",
                [$cid, $u["id"]],
            )["n"];
            if (!$lessons || $done < $lessons) {
                fail(422, "يمكنك تقييم التجربة بعد إكمال دروس الدورة.");
            }
            if (
                one(
                    "SELECT id FROM course_surveys WHERE course_id=? AND student_id=?",
                    [$cid, $u["id"]],
                )
            ) {
                fail(409, "وصلنا تقييمك لهذه الدورة. شكرًا لك.");
            }
            run(
                "INSERT INTO course_surveys(id,course_id,student_id,content_rating,trainer_rating,experience_rating,comment,created_at) VALUES(?,?,?,?,?,?,?,?)",
                [uid(), $cid, $u["id"], ...$ratings, enc($comment), now()],
            );
        });
        return ["ok" => true];
    }
    return null;
}

function trainingReport(array $u, array $d): array
{
    auth(["admin", "instructor"]);
    $cid = str($d["course_id"] ?? "", 40, false);
    $withArchived = ($d["include_archived"] ?? "") === "1";
    $where = $withArchived
        ? "1=1"
        : "c.status<>'archived' AND " . recordAvailable("course", "c.id");
    $lesson = $withArchived ? "1=1" : recordAvailable("lesson", "l.id");
    $certificate = $withArchived
        ? "1=1"
        : recordAvailable("certificate", "f.id");
    $assignment = $withArchived ? "1=1" : recordAvailable("assignment", "a.id");
    $class = $withArchived ? "1=1" : recordAvailable("class", "cl.id");
    $learner = $withArchived
        ? "1=1"
        : recordAvailable("account", "e.student_id");
    $args = [];
    if ($u["role"] === "instructor") {
        $where .= " AND c.instructor_id=?";
        $args[] = $u["id"];
    }
    if ($cid) {
        courseAccess($u, $cid, true);
        $where .= " AND c.id=?";
        $args[] = $cid;
    }
    $out = pagedList(
        "SELECT c.id,c.title,c.status,(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id AND $learner) students,(SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id AND $lesson) lessons,(SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id=p.lesson_id JOIN enrollments e ON e.course_id=l.course_id AND e.student_id=p.student_id WHERE l.course_id=c.id AND $lesson AND $learner) completed,(SELECT COUNT(*) FROM certificates f WHERE f.course_id=c.id AND $certificate) certificates,(SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.course_id=c.id AND s.score IS NOT NULL AND $assignment) graded,(SELECT COUNT(*) FROM course_surveys s WHERE s.course_id=c.id) survey_responses,(SELECT AVG(experience_rating) FROM course_surveys s WHERE s.course_id=c.id) satisfaction FROM courses c WHERE " .
            $where .
            " ORDER BY c.created_at DESC,c.id",
        "SELECT COUNT(*) n FROM courses c WHERE " . $where,
        $args,
        number($d["page"] ?? 1, 1, 1000000),
    );
    $out["attendance"] = rows(
        "SELECT a.status,COUNT(*) records FROM attendance a JOIN classes cl ON cl.id=a.class_id JOIN courses c ON c.id=cl.course_id WHERE $class AND " .
            $where .
            " GROUP BY a.status",
        $args,
    );
    $out["summary"] = one(
        "SELECT COUNT(DISTINCT e.student_id) students,COUNT(e.id) enrollments FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE $learner AND " .
            $where,
        $args,
    );
    return $out;
}
