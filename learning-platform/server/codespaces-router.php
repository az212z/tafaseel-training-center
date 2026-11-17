<?php
// Private temporary Codespaces server, not a public production web server.
declare(strict_types=1);
if (PHP_SAPI !== "cli-server") {
    exit(1);
}
$path = rawurldecode(parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH) ?: "/");
if ($path === "/api/index.php") {
    putenv("TAFASEEL_PRIVATE_DIR=" . __DIR__);
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
header("Cache-Control: no-store");
if (
    preg_match(
        '#(?:^|/)\.|(?:^|/)(?:server|storage|vendor|node_modules|reference|tests|scripts|api)(?:/|$)|\.(?:php|ini|sql|sqlite|db|log|zip|bak|env)$#i',
        $path,
    ) ||
    str_contains($path, "..") ||
    str_contains($path, "\0") ||
    str_contains($path, "\\")
) {
    http_response_code(404);
    exit("Not found");
}
if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "HEAD"], true)) {
    http_response_code(405);
    exit("Method not allowed");
}
$public = realpath(__DIR__ . "/../dist");
$file = $public ? realpath($public . $path) : false;
if (
    $file &&
    is_file($file) &&
    str_starts_with($file, $public . DIRECTORY_SEPARATOR)
) {
    return false;
}
if (pathinfo($path, PATHINFO_EXTENSION)) {
    http_response_code(404);
    exit("Not found");
}
header("Content-Type: text/html; charset=utf-8");
readfile(__DIR__ . "/../dist/index.html");
return true;
