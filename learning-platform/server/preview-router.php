<?php
// Local production-bundle verification only. Never run this server on a public interface.
if (PHP_SAPI !== "cli-server") {
    exit(1);
}
putenv("TAFASEEL_PRIVATE_DIR=" . __DIR__);
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
if (str_starts_with($path, "/api/")) {
    require __DIR__ . "/../public/api/index.php";
    return true;
}
header(
    "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://video.bunnycdn.com; media-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://player.mediadelivery.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
);
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: strict-origin-when-cross-origin");
header(
    "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
);
if ($path !== "/" && is_file(__DIR__ . "/../dist" . $path)) {
    return false;
}
header("Content-Type: text/html; charset=utf-8");
readfile(__DIR__ . "/../dist/index.html");
