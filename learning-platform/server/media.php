<?php
declare(strict_types=1);
function s3Client(): \Aws\S3\S3Client
{
    static $client;
    if ($client) {
        return $client;
    }
    $c = requireIntegration("s3");
    $autoload = __DIR__ . "/vendor/autoload.php";
    if (!is_file($autoload)) {
        $autoload = dirname(__DIR__) . "/vendor/autoload.php";
    }
    if (!is_file($autoload)) {
        throw new RuntimeException("Storage SDK missing");
    }
    require_once $autoload;
    $options = [
        "version" => "latest",
        "region" => $c["region"],
        "credentials" => [
            "key" => $c["access_key"],
            "secret" => $c["secret_key"],
        ],
        "http" => ["connect_timeout" => 5, "timeout" => 30, "verify" => true],
        "retries" => 1,
        "request_checksum_calculation" => "when_required",
    ];
    if (!empty($c["endpoint"])) {
        if (
            parse_url($c["endpoint"], PHP_URL_SCHEME) !== "https" &&
            !(
                cfg()["environment"] === "local" &&
                (cfg()["testing"] ?? false) &&
                preg_match('#^http://127\.0\.0\.1:[0-9]+$#', $c["endpoint"])
            )
        ) {
            throw new RuntimeException("Storage endpoint must use HTTPS");
        }
        $options["endpoint"] = $c["endpoint"];
        $options["use_path_style_endpoint"] = true;
    }
    return $client = new \Aws\S3\S3Client($options);
}
function storeEncryptedObject(string $name, string $encrypted): string
{
    if (integrationEnabled("s3")) {
        $c = integrationConfig("s3");
        s3Client()->putObject([
            "Bucket" => $c["bucket"],
            "Key" => "tafaseel/files/" . $name,
            "Body" => $encrypted,
            "ContentType" => "application/octet-stream",
        ]);
        return "s3:" . $name;
    }
    $dir = cfg()["storage"] . "/files";
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    if (file_put_contents($dir . "/" . $name, $encrypted, LOCK_EX) === false) {
        throw new RuntimeException("Cannot save file");
    }
    chmod($dir . "/" . $name, 0600);
    return $name;
}
function encryptedObject(string $name): string
{
    if (str_starts_with($name, "s3:")) {
        $c = requireIntegration("s3");
        $r = s3Client()->getObject([
            "Bucket" => $c["bucket"],
            "Key" => "tafaseel/files/" . substr($name, 3),
        ]);
        return (string) $r["Body"];
    }
    $path = cfg()["storage"] . "/files/" . $name;
    if (!is_file($path)) {
        fail(404, "الملف غير موجود.");
    }
    return file_get_contents($path);
}
function discardObject(string $name): void
{
    if (str_starts_with($name, "s3:")) {
        $c = requireIntegration("s3");
        s3Client()->deleteObject([
            "Bucket" => $c["bucket"],
            "Key" => "tafaseel/files/" . substr($name, 3),
        ]);
    } else {
        @unlink(cfg()["storage"] . "/files/" . $name);
    }
}
function videoRow(array $u, string $id): array
{
    $v = one(
        "SELECT * FROM video_assets v WHERE id=? AND " .
            recordAvailable("video", "v.id"),
        [$id],
    );
    if (!$v) {
        fail(404, "الفيديو غير موجود.");
    }
    courseAccess($u, $v["course_id"], true);
    return $v;
}
function videoRequest(string $method, string $path, ?array $body = null): array
{
    $c = requireIntegration("video");
    return providerRequest(
        "video",
        $method,
        "/library/" .
            rawurlencode((string) $c["library_id"]) .
            "/videos" .
            $path,
        $body,
        ["AccessKey: " . $c["api_key"]],
    );
}
function videoCredentials(array $u, string $id): array
{
    $v = videoRow($u, $id);
    if ($v["status"] === "ready") {
        fail(409, "الفيديو جاهز بالفعل.");
    }
    $c = requireIntegration("video");
    $expiry = time() + 86400;
    return [
        "id" => $v["id"],
        "video_id" => $v["provider_id"],
        "library_id" => (string) $c["library_id"],
        "expires" => $expiry,
        "signature" => hash(
            "sha256",
            (string) $c["library_id"] .
                $c["api_key"] .
                $expiry .
                $v["provider_id"],
        ),
        "endpoint" => "https://video.bunnycdn.com/tusupload",
    ];
}
function syncVideo(array $u, string $id): array
{
    $v = videoRow($u, $id);
    $r = videoRequest("GET", "/" . rawurlencode($v["provider_id"]));
    if (($r["guid"] ?? "") !== $v["provider_id"]) {
        throw new ProviderError("video_id_mismatch");
    }
    $bytes = (int) ($r["storageSize"] ?? 0);
    $providerStatus = (int) ($r["status"] ?? -1);
    $status =
        $providerStatus === 3
            ? "ready"
            : ($providerStatus === 5
                ? "failed"
                : "processing");
    if ($bytes > (int) (cfg()["max_video_upload_bytes"] ?? 10737418240)) {
        $status = "rejected";
    }
    run("UPDATE video_assets SET status=?,bytes=?,updated_at=? WHERE id=?", [
        $status,
        $bytes,
        now(),
        $id,
    ]);
    return ["id" => $id, "status" => $status, "bytes" => $bytes];
}
function videoPlayback(array $u, string $lessonId): array
{
    $l = one(
        "SELECT course_id FROM lessons l WHERE id=? AND " .
            recordAvailable("lesson", "l.id"),
        [$lessonId],
    );
    if (!$l) {
        fail(404, "الدرس غير موجود.");
    }
    courseAccess($u, $l["course_id"]);
    $v = one(
        "SELECT provider_id FROM video_assets v WHERE lesson_id=? AND status='ready' AND " .
            recordAvailable("video", "v.id"),
        [$lessonId],
    );
    if (!$v) {
        fail(404, "الفيديو قيد التجهيز أو غير متاح.");
    }
    $c = requireIntegration("video");
    $expiry = time() + 3600;
    $token = hash("sha256", $c["token_key"] . $v["provider_id"] . $expiry);
    return [
        "url" =>
            "https://player.mediadelivery.net/embed/" .
            rawurlencode((string) $c["library_id"]) .
            "/" .
            rawurlencode($v["provider_id"]) .
            "?token=" .
            $token .
            "&expires=" .
            $expiry .
            "&autoplay=false",
        "expires_at" => $expiry,
    ];
}
function reserveUpload(string $id, int $bytes): void
{
    tx(function () use ($id, $bytes) {
        lockRow("storage_locks", "files");
        run("DELETE FROM upload_reservations WHERE expires_at<?", [now()]);
        $used = (int) one("SELECT COALESCE(SUM(bytes),0) n FROM files")["n"];
        $reserved = (int) one(
            "SELECT COALESCE(SUM(bytes),0) n FROM upload_reservations",
        )["n"];
        if (
            $used + $reserved + $bytes >
            (int) (cfg()["storage_quota_bytes"] ?? 2147483648)
        ) {
            fail(409, "بلغت الملفات سعة التخزين المعتمدة في إعدادات المركز.");
        }
        run(
            "INSERT INTO upload_reservations(id,bytes,expires_at) VALUES(?,?,?)",
            [$id, $bytes, gmdate("Y-m-d\TH:i:s\Z", time() + 3600)],
        );
    });
}
