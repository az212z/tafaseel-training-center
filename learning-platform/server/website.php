<?php
declare(strict_types=1);
function websiteContent(bool $private = false): array
{
    $default = json_decode(
        file_get_contents(__DIR__ . "/website-defaults.json"),
        true,
        64,
        JSON_THROW_ON_ERROR,
    );
    $row = one("SELECT payload FROM website_content WHERE id=?", ["main"]);
    $stored = $row
        ? json_decode($row["payload"], true, 64, JSON_THROW_ON_ERROR)
        : setting("website", []);
    $content = array_replace($default, $stored);
    $content["site"] = array_replace($default["site"], $stored["site"] ?? []);
    $live = rows(
        "SELECT c.id,c.title,c.duration,c.status,o.price_minor,o.enrollment_open FROM courses c LEFT JOIN course_commerce o ON o.course_id=c.id",
    );
    foreach ($content["programs"] as &$p) {
        $p["availability"] = null;
        foreach ($live as $c) {
            $matches = !empty($p["course_id"])
                ? $p["course_id"] === $c["id"]
                : $p["title"] === $c["title"];
            if ($matches && $c["status"] === "published") {
                $p["availability"] = [
                    "id" => $c["id"],
                    "duration" => (int) $c["duration"],
                    "price_minor" => isset($c["price_minor"])
                        ? (int) $c["price_minor"]
                        : null,
                    "open" => (bool) $c["enrollment_open"],
                ];
                break;
            }
        }
        if (!$private) {
            unset($p["course_id"]);
        }
    }
    unset($p);
    if (!$private) {
        $content["programs"] = array_values(
            array_filter($content["programs"], fn($p) => $p["visible"]),
        );
        // Answers remain in the browser for this explicitly illustrative, ungraded exercise.
        unset($content["revision"]);
    }
    $content["registration_enabled"] =
        (bool) (cfg()["registration_enabled"] ?? true);
    return $content;
}
function websiteTextList(mixed $items, int $max = 12): array
{
    if (!is_array($items) || !array_is_list($items) || count($items) > $max) {
        fail(422, "عدد العناصر غير صالح.");
    }
    return array_map(fn($s) => str($s, 500), $items);
}
function websiteAction(string $action, string $method, array $d): ?array
{
    $gets = ["website", "website.admin", "website.inquiries"];
    $posts = [
        "website.save",
        "website.inquiry",
        "website.inquiry.status",
        "certificate.verify",
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
    if ($action === "website") {
        return websiteContent();
    }
    if ($action === "website.inquiry") {
        rate("website-inquiry:" . ($_SERVER["REMOTE_ADDR"] ?? ""), 5, 3600);
        if (!empty($d["website"])) {
            fail(422, "تعذّر تقديم الطلب.");
        }
        if (($d["consent"] ?? false) !== true) {
            fail(422, "الموافقة على التواصل بخصوص الطلب مطلوبة.");
        }
        $kind = $d["kind"] ?? "contact";
        if (
            !in_array(
                $kind,
                ["contact", "program", "business", "trainer"],
                true,
            )
        ) {
            fail(422, "نوع الطلب غير صالح.");
        }
        $slug = str($d["program_slug"] ?? "", 100, false);
        if (
            $slug &&
            !in_array(
                $slug,
                array_column(websiteContent()["programs"], "slug"),
                true,
            )
        ) {
            fail(422, "الدورة غير موجودة.");
        }
        if ($kind === "program" && !$slug) {
            fail(422, "اختر الدورة المطلوبة.");
        }
        $payload = [
            "name" => str($d["name"] ?? "", 120),
            "phone" => phone($d["phone"] ?? ""),
            "email" => !empty($d["email"]) ? email($d["email"]) : "",
            "organization" => str($d["organization"] ?? "", 160, false),
            "message" => str($d["message"] ?? "", 3000),
            "consent_at" => now(),
        ];
        $id = uid();
        $reference = "TF-" . strtoupper(substr($id, 0, 12));
        run(
            "INSERT INTO website_inquiries(id,reference,kind,program_slug,payload,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
            [
                $id,
                $reference,
                $kind,
                $slug,
                enc(json_encode($payload, JSON_UNESCAPED_UNICODE)),
                "new",
                now(),
                now(),
            ],
        );
        emailAdmins(
            "inquiry:" . $id,
            "طلب تواصل جديد — " . $reference,
            "وصل طلب جديد عبر الموقع. الرقم المرجعي: " .
                $reference .
                ". راجع بياناته في مركز إدارة الموقع.",
            "/website",
        );
        return [
            "ok" => true,
            "reference" => $reference,
            "message" =>
                "وصل طلبك إلى إدارة تفاصيل للمراجعة. احتفظ بالرقم المرجعي؛ هذا الطلب لا يؤكد حجزًا أو سدادًا.",
        ];
    }
    if ($action === "certificate.verify") {
        rate("certificate-verify:" . ($_SERVER["REMOTE_ADDR"] ?? ""), 15, 900);
        $serial = strtoupper(str($d["serial"] ?? "", 60));
        if (!preg_match('/^TF-[0-9]{4}-[A-F0-9]{10}$/', $serial)) {
            fail(422, "أدخل رقم شهادة تفاصيل كاملًا كما يظهر عليها.");
        }
        $c = one(
            "SELECT f.serial,f.issued_at,c.title FROM certificates f JOIN courses c ON c.id=f.course_id WHERE f.serial=?",
            [$serial],
        );
        return ["valid" => (bool) $c, "certificate" => $c ?: null];
    }
    $u = auth(["admin"]);
    staffMfaGuard($u, $action);
    if ($action === "website.admin") {
        return websiteContent(true);
    }
    if ($action === "website.inquiries") {
        $status = $d["status"] ?? "";
        if (!in_array($status, ["", "new", "contacted", "closed"], true)) {
            fail(422, "حالة الطلب غير صالحة.");
        }
        $where = $status ? " WHERE status=?" : "";
        $args = $status ? [$status] : [];
        $result = pagedList(
            "SELECT * FROM website_inquiries" .
                $where .
                " ORDER BY created_at DESC,id DESC",
            "SELECT COUNT(*) n FROM website_inquiries" . $where,
            $args,
            number($d["page"] ?? 1, 1, 1000000),
        );
        foreach ($result["items"] as &$item) {
            $item["details"] = json_decode(dec($item["payload"]), true);
            unset($item["payload"]);
        }
        unset($item);
        audit($u, "website.inquiries_viewed");
        return $result;
    }
    if ($action === "website.inquiry.status") {
        $id = str($d["id"] ?? "", 40);
        $status = $d["status"] ?? "";
        if (!in_array($status, ["new", "contacted", "closed"], true)) {
            fail(422, "حالة الطلب غير صالحة.");
        }
        if (!one("SELECT id FROM website_inquiries WHERE id=?", [$id])) {
            fail(404, "الطلب غير موجود.");
        }
        run("UPDATE website_inquiries SET status=?,updated_at=? WHERE id=?", [
            $status,
            now(),
            $id,
        ]);
        audit($u, "website.inquiry_updated", $id);
        return ["ok" => true];
    }
    return tx(function () use ($d, $u) {
        // Row lock serializes revisions on both supported databases.
        lockRow("storage_locks", "files");
        $content = websiteContent(true);
        if ((int) ($d["revision"] ?? 0) !== (int) $content["revision"]) {
            fail(409, "عُدّل المحتوى في جلسة أخرى. أعد تحميل الصفحة قبل الحفظ.");
        }
        $section = $d["section"] ?? "";
        $v = $d["value"] ?? [];
        if (!is_array($v)) {
            fail(422, "المحتوى غير صالح.");
        }
        if ($section === "site") {
            $site = [];
            foreach ($content["site"] as $key => $current) {
                $site[$key] = str(
                    $v[$key] ?? "",
                    in_array($key, [
                        "about",
                        "business_description",
                        "hero_description",
                    ])
                        ? 3000
                        : 300,
                    !in_array($key, ["email", "address", "announcement"], true),
                );
            }
            $site["phone"] = phone($site["phone"]);
            $site["whatsapp"] = preg_replace(
                "/\D/",
                "",
                phone($site["whatsapp"]),
            );
            if ($site["email"]) {
                $site["email"] = email($site["email"]);
            }
            $content["site"] = $site;
        } elseif ($section === "program") {
            $slug = str($d["slug"] ?? "", 100);
            $index = array_search(
                $slug,
                array_column($content["programs"], "slug"),
                true,
            );
            if ($index === false) {
                if (($d["create"] ?? false) !== true) {
                    fail(404, "الدورة غير موجودة.");
                }
                if (
                    !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) ||
                    strlen($slug) > 80 ||
                    count($content["programs"]) >= 200
                ) {
                    fail(
                        422,
                        "رابط الدورة غير صالح أو بلغ الدليل الحد المسموح.",
                    );
                }
                $category = str($v["category"] ?? "", 40);
                if (
                    !in_array(
                        $category,
                        array_column($content["categories"], "id"),
                        true,
                    )
                ) {
                    fail(422, "المجال غير موجود.");
                }
                $index = count($content["programs"]);
                $p = [
                    "slug" => $slug,
                    "category" => $category,
                    "image" => "/images/facility/main-training-room.webp",
                    "imageAlt" => "قاعة تدريب في مركز تفاصيل",
                ];
            } else {
                if (($d["create"] ?? false) === true) {
                    fail(409, "رابط الدورة مستخدم بالفعل.");
                }
                $p = $content["programs"][$index];
            }
            foreach (
                [
                    "title" => 160,
                    "description" => 1000,
                    "overview" => 4000,
                    "audience" => 1500,
                    "prerequisites" => 1500,
                ]
                as $key => $length
            ) {
                $p[$key] = str($v[$key] ?? "", $length);
            }
            $p["topics"] = websiteTextList($v["topics"] ?? []);
            $p["outcomes"] = websiteTextList($v["outcomes"] ?? []);
            $p["visible"] = ($v["visible"] ?? false) === true;
            $p["featured"] = ($v["featured"] ?? false) === true;
            $p["course_id"] = str($v["course_id"] ?? "", 40, false);
            if (
                $p["course_id"] &&
                !one("SELECT id FROM courses WHERE id=?", [$p["course_id"]])
            ) {
                fail(422, "الدورة التعليمية غير موجودة.");
            }
            unset($p["availability"]);
            $content["programs"][$index] = $p;
        } elseif ($section === "faq") {
            if (!array_is_list($v) || count($v) > 30) {
                fail(422, "عدد الأسئلة غير صالح.");
            }
            $content["faqs"] = array_map(
                fn($f) => [
                    "q" => str($f["q"] ?? "", 300),
                    "a" => str($f["a"] ?? "", 2500),
                ],
                $v,
            );
        } elseif ($section === "article") {
            $id = str($d["id"] ?? "", 60);
            $index = array_search(
                $id,
                array_column($content["articles"], "id"),
                true,
            );
            if ($index === false) {
                if (($d["create"] ?? false) !== true) {
                    fail(404, "المقال غير موجود.");
                }
                if (
                    !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $id) ||
                    strlen($id) > 60 ||
                    count($content["articles"]) >= 100
                ) {
                    fail(
                        422,
                        "رابط المقال غير صالح أو بلغت المكتبة الحد المسموح.",
                    );
                }
                $index = count($content["articles"]);
            } elseif (($d["create"] ?? false) === true) {
                fail(409, "رابط المقال مستخدم بالفعل.");
            }
            if (
                !is_array($v["sections"] ?? null) ||
                !array_is_list($v["sections"]) ||
                count($v["sections"]) > 15
            ) {
                fail(422, "أقسام المقال غير صالحة.");
            }
            $content["articles"][$index] = [
                "id" => $id,
                "title" => str($v["title"] ?? "", 180),
                "category" => str($v["category"] ?? "", 100),
                "minutes" => number($v["minutes"] ?? 3, 1, 60),
                "intro" => str($v["intro"] ?? "", 1500),
                "sections" => array_map(
                    fn($s) => [
                        "title" => str($s["title"] ?? "", 200),
                        "text" => str($s["text"] ?? "", 4000),
                    ],
                    $v["sections"],
                ),
            ];
        } elseif ($section === "page") {
            $id = str($d["id"] ?? "", 40);
            if (!isset($content["pages"][$id])) {
                fail(404, "الصفحة غير موجودة.");
            }
            if (
                !is_array($v["sections"] ?? null) ||
                !array_is_list($v["sections"]) ||
                count($v["sections"]) > 20
            ) {
                fail(422, "فقرات الصفحة غير صالحة.");
            }
            $content["pages"][$id] = [
                "title" => str($v["title"] ?? "", 180),
                "intro" => str($v["intro"] ?? "", 1500),
                "sections" => array_map(function ($s) {
                    if (!is_array($s) || count($s) !== 2) {
                        fail(422, "فقرة الصفحة غير صالحة.");
                    }
                    return [str($s[0] ?? "", 200), str($s[1] ?? "", 4000)];
                }, $v["sections"]),
            ];
        } else {
            fail(422, "قسم المحتوى غير صالح.");
        }
        $content["revision"]++;
        unset($content["registration_enabled"]);
        foreach ($content["programs"] as &$p) {
            unset($p["availability"]);
        }
        unset($p);
        $payload = json_encode(
            $content,
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );
        if (one("SELECT id FROM website_content WHERE id=?", ["main"])) {
            run("UPDATE website_content SET payload=? WHERE id=?", [
                $payload,
                "main",
            ]);
        } else {
            run("INSERT INTO website_content(id,payload) VALUES(?,?)", [
                "main",
                $payload,
            ]);
        }
        audit($u, "website.updated", $section);
        return ["ok" => true, "revision" => $content["revision"]];
    });
}
