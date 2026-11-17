<?php
declare(strict_types=1);
ini_set("display_errors", "0");
header("Content-Type: text/html; charset=utf-8");
header("Cache-Control: no-store");
try {
    $private =
        getenv("TAFASEEL_PRIVATE_DIR") ?:
        dirname(__DIR__) . "/tafaseel-learning-private";
    require_once $private . "/api.php";
    $path = rawurldecode(
        parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH) ?: "/",
    );
    $path = rtrim($path, "/") ?: "/";
    $c = websiteContent();
    $base = "https://tafaseel-learn.com";
    $e = fn($v) => htmlspecialchars(
        (string) $v,
        ENT_QUOTES | ENT_SUBSTITUTE,
        "UTF-8",
    );
    $labels = [
        "/" => "مركز تفاصيل للتدريب | برامجك ومساحتك التعليمية",
        "/programs" => "الدورات والبرامج",
        "/tracks" => "مجالات التعلّم",
        "/learning-paths" => "مسارات التعلم",
        "/about" => "عن مركز تفاصيل",
        "/gallery" => "صور المركز",
        "/business" => "تدريب الجهات",
        "/teach" => "انضم كمدرب",
        "/library" => "مكتبة التعلّم",
        "/practice" => "تمارين توضيحية",
        "/help" => "مركز المساعدة",
        "/faq" => "الأسئلة الشائعة",
        "/contact" => "تواصل معنا",
        "/verify" => "التحقق من الشهادات",
        "/privacy" => "سياسة الخصوصية",
        "/terms" => "شروط الاستخدام",
        "/registration-policy" => "سياسة التسجيل والإلغاء",
        "/sitemap" => "خريطة الموقع",
        "/register" => "طلب إنشاء حساب",
    ];
    $program = null;
    $article = null;
    $category = null;
    foreach ($c["programs"] as $p) {
        if ($path === "/programs/" . $p["slug"]) {
            $program = $p;
        }
    }
    foreach ($c["articles"] as $a) {
        if ($path === "/library/" . $a["id"]) {
            $article = $a;
        }
    }
    foreach ($c["categories"] as $g) {
        if ($path === "/tracks/" . $g["id"]) {
            $category = $g;
        }
    }
    if ($path === "/sitemap.xml") {
        header("Content-Type: application/xml; charset=utf-8");
        $urls = array_filter(
            array_keys($labels),
            fn($s) => !in_array(
                $s,
                ["/register", "/faq", "/tracks", "/sitemap"],
                true,
            ),
        );
        foreach ($c["programs"] as $p) {
            $urls[] = "/programs/" . $p["slug"];
        }
        foreach ($c["categories"] as $g) {
            $urls[] = "/tracks/" . $g["id"];
        }
        foreach ($c["articles"] as $a) {
            $urls[] = "/library/" . $a["id"];
        }
        echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach ($urls as $url) {
            echo "<url><loc>" . $e($base . $url) . "</loc></url>";
        }
        echo "</urlset>";
        exit();
    }
    $platform = preg_match(
        '#^/(login|dashboard|website|paths|notebook|readiness|communications|courses|catalog|bags|videos|payments|notifications|integrations|students|assignments|quizzes|schedule|attendance|files|certificates|reports|announcements|users|settings|support)(/|$)#',
        $path,
    );
    $found =
        isset($labels[$path]) || $program || $article || $category || $platform;
    if (!$found) {
        http_response_code(404);
    }
    $policyKey =
        [
            "/privacy" => "privacy",
            "/terms" => "terms",
            "/registration-policy" => "registration",
        ][$path] ?? null;
    $title =
        ($policyKey ? $c["pages"][$policyKey]["title"] : null) ??
        ($program["title"] ??
            ($article["title"] ??
                ($category["title"] ??
                    ($labels[$path] ??
                        ($platform
                            ? "المنصة التعليمية"
                            : "الصفحة غير موجودة")))));
    $description =
        ($policyKey ? $c["pages"][$policyKey]["intro"] : null) ??
        ($program["description"] ??
            ($article["intro"] ??
                ($category["description"] ?? $c["site"]["hero_description"])));
    $indexable = $found && !$platform && $path !== "/register";
    $html = file_get_contents(__DIR__ . "/index.html");
    $html = preg_replace(
        "#<title>.*?</title>#s",
        "<title>" .
            $e($title . ($path === "/" ? "" : " | تفاصيل")) .
            "</title>",
        $html,
    );
    $html = preg_replace(
        '#<meta name="description" content="[^"]*"\s*/?>#',
        '<meta name="description" content="' . $e($description) . '">',
        $html,
    );
    $html = preg_replace(
        '#<meta name="robots" content="[^"]*"\s*/?>#',
        '<meta name="robots" content="' .
            ($indexable ? "index,follow" : "noindex,nofollow") .
            '">',
        $html,
    );
    $head =
        '<link rel="canonical" href="' .
        $e($base . $path) .
        '"><meta property="og:type" content="website"><meta property="og:locale" content="ar_SA"><meta property="og:title" content="' .
        $e($title) .
        '"><meta property="og:description" content="' .
        $e($description) .
        '"><meta property="og:url" content="' .
        $e($base . $path) .
        '"><meta property="og:image" content="' .
        $base .
        $e($program["image"] ?? "/images/facility/main-training-room.webp") .
        '"><meta name="twitter:card" content="summary_large_image">';
    $html = str_replace("</head>", $head . "</head>", $html);
    $body =
        '<div class="site"><main class="site-container"><header class="site-heading"><a href="/">تفاصيل — الرئيسية</a><h1>' .
        $e($title) .
        "</h1><p>" .
        $e($description) .
        "</p></header>";
    if ($program) {
        $body .=
            '<article class="site-prose"><h2>عن الدورة</h2><p>' .
            $e($program["overview"]) .
            "</p><h2>الفئة المستهدفة</h2><p>" .
            $e($program["audience"]) .
            "</p><h2>متطلبات البداية</h2><p>" .
            $e($program["prerequisites"]) .
            "</p>";
        foreach (
            ["topics" => "محاور التعلّم", "outcomes" => "المهارات المستهدفة"]
            as $key => $label
        ) {
            if ($program[$key]) {
                $body .= "<h2>" . $e($label) . "</h2><ul>";
                foreach ($program[$key] as $text) {
                    $body .= "<li>" . $e($text) . "</li>";
                }
                $body .= "</ul>";
            }
        }
        $body .= "</article>";
    } elseif ($policyKey && isset($c["pages"][$policyKey])) {
        foreach ($c["pages"][$policyKey]["sections"] as [$t, $d]) {
            $body .= "<h2>" . $e($t) . "</h2><p>" . $e($d) . "</p>";
        }
    } elseif ($article) {
        $body .= '<article class="site-prose">';
        foreach ($article["sections"] as $s) {
            $body .=
                "<h2>" . $e($s["title"]) . "</h2><p>" . $e($s["text"]) . "</p>";
        }
        $body .= "</article>";
    } elseif ($path === "/about") {
        $body .= "<p>" . $e($c["site"]["about"]) . "</p>";
    } elseif (in_array($path, ["/help", "/faq"], true)) {
        foreach ($c["faqs"] as $f) {
            $body .= "<h2>" . $e($f["q"]) . "</h2><p>" . $e($f["a"]) . "</p>";
        }
    }
    if (!$platform && !$program && !$article) {
        $body .=
            '<nav aria-label="دورات المركز"><h2>اكتشف دورات تفاصيل</h2><ul>';
        foreach ($c["programs"] as $p) {
            if (!$category || $p["category"] === $category["id"]) {
                $body .=
                    '<li><a href="/programs/' .
                    $e($p["slug"]) .
                    '">' .
                    $e($p["title"]) .
                    "</a></li>";
            }
        }
        $body .= "</ul></nav>";
    }
    $body .=
        '<nav aria-label="روابط المركز"><a href="/programs">الدورات</a> · <a href="/about">عن تفاصيل</a> · <a href="/contact">تواصل معنا</a> · <a href="/help">المساعدة</a> · <a href="/login">تسجيل الدخول</a></nav></main></div>';
    // Readable initial HTML is replaced by the interactive application on load.
    $html = str_replace(
        '<div id="root"></div>',
        '<div id="root">' . $body . "</div>",
        $html,
    );
    echo $html;
} catch (Throwable $error) {
    http_response_code(503);
    echo '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تفاصيل</title><h1>تعذّر تحميل الصفحة مؤقتًا.</h1><p>حاول مجددًا بعد قليل.</p></html>';
    error_log("Tafaseel page rendering failed: " . get_class($error));
}
