<?php
declare(strict_types=1);

// The frame size is part of the stored format and must remain stable for existing videos.
const LESSON_VIDEO_PART = 4194304;
function lessonVideoLimit(): int
{
    return (int) (cfg()["lesson_video_bytes"] ?? 10737418240);
}
function lessonPartName(string $id, int $index): string
{
    return $id . "-" . $index . ".enc";
}
function sealLessonPart(string $name, string $bytes): string
{
    $iv = random_bytes(12);
    $tag = "";
    $cipher = openssl_encrypt(
        $bytes,
        "aes-256-gcm",
        hex2bin(cfg()["key"]),
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        $name,
    );
    if ($cipher === false) {
        throw new RuntimeException("Video encryption failed");
    }
    return $iv . $tag . $cipher;
}
function readFileFrame(
    string $key,
    string $object,
    int $offset,
    int $len,
    bool $packed,
): string {
    $stream = openEncryptedObject($object, $offset, $packed ? $len + 28 : null);
    try {
        $iv = stream_get_contents($stream, 12);
        $tag = stream_get_contents($stream, 16);
        $cipher = stream_get_contents($stream, $len);
        if (
            strlen($iv) !== 12 ||
            strlen($tag) !== 16 ||
            strlen($cipher) !== $len
        ) {
            throw new RuntimeException("Incomplete encrypted frame");
        }
        $plain = openssl_decrypt(
            $cipher,
            "aes-256-gcm",
            hex2bin(cfg()["key"]),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            $key,
        );
        if ($plain === false) {
            throw new RuntimeException("Invalid encrypted file frame");
        }
        return $plain;
    } finally {
        fclose($stream);
    }
}
function beginLessonVideo(array $u, array $d): array
{
    $course = str($d["course_id"] ?? "", 40);
    courseAccess($u, $course, true);
    $name = str(basename(str($d["name"] ?? "", 180)), 180);
    if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== "mp4") {
        fail(422, "اختر ملف فيديو بصيغة MP4.");
    }
    $bytes = filter_var($d["bytes"] ?? null, FILTER_VALIDATE_INT);
    if (!$bytes || $bytes < 1 || $bytes > lessonVideoLimit()) {
        fail(413, "يتجاوز حجم الفيديو الحد المسموح.");
    }
    rate("upload:" . $u["id"], 30, 3600);
    $driver = integrationEnabled("s3") ? "s3" : "local";
    if ($driver === "local" && cfg()["environment"] === "production") {
        fail(503, "تخزين الفيديو غير متصل. راجع الإدارة.");
    }
    $id = uid();
    reserveUpload($id, $bytes, function ($expiry) use (
        $id,
        $u,
        $course,
        $name,
        $bytes,
        $driver,
    ) {
        run(
            "INSERT INTO lesson_video_uploads(id,owner_id,course_id,name,bytes,driver,expires_at) VALUES(?,?,?,?,?,?,?)",
            [$id, $u["id"], $course, $name, $bytes, $driver, $expiry],
        );
    });
    return ["id" => $id, "part_bytes" => LESSON_VIDEO_PART];
}
function acceptLessonVideoPart(array $u, array $d): array
{
    $id = str($d["id"] ?? "", 40);
    $index = number($d["index"] ?? -1, 0, 65535);
    $part = $_FILES["file"] ?? [];
    if (
        ($part["error"] ?? -1) !== UPLOAD_ERR_OK ||
        !is_uploaded_file($part["tmp_name"]) ||
        (int) $part["size"] < 1 ||
        (int) $part["size"] > LESSON_VIDEO_PART
    ) {
        fail(422, "تعذّر قراءة جزء الفيديو.");
    }
    session_write_close();
    return tx(function () use ($u, $id, $index, $part) {
        lockRow("lesson_video_uploads", $id);
        $upload = one(
            "SELECT * FROM lesson_video_uploads WHERE id=? AND owner_id=?",
            [$id, $u["id"]],
        );
        if (!$upload) {
            // A final response may have been lost after publication.
            $file = one(
                "SELECT id,name,course_id FROM files WHERE id=? AND owner_id=? AND purpose='resource' AND " .
                    recordAvailable("file", "files.id"),
                [$id, $u["id"]],
            );
            if ($file) {
                courseAccess($u, $file["course_id"], true);
                return [
                    "id" => $id,
                    "name" => $file["name"],
                    "complete" => true,
                ];
            }
            fail(404, "تعذّر العثور على عملية الرفع.");
        }
        courseAccess($u, $upload["course_id"], true);
        $expiry = gmdate("Y-m-d\TH:i:s\Z", time() + 3600);
        // Renew the quota reservation before writing, including when a request is retried.
        $reservation = db()->prepare(
            "UPDATE upload_reservations SET expires_at=? WHERE id=? AND expires_at>=?",
        );
        $reservation->execute([$expiry, $id, now()]);
        if (
            $upload["expires_at"] < now() ||
            !one("SELECT id FROM upload_reservations WHERE id=?", [$id])
        ) {
            fail(410, "انتهت مهلة رفع الفيديو. اختر الملف مجددًا.");
        }
        $received = (int) $upload["received"];
        $size = (int) $upload["bytes"];
        $expected = min(LESSON_VIDEO_PART, $size - $index * LESSON_VIDEO_PART);
        if ((int) $part["size"] !== $expected || $index > $received) {
            fail(409, "ترتيب أجزاء الفيديو أو حجمها غير صحيح.");
        }
        if ($index < $received) {
            return ["complete" => false, "received" => $received];
        }
        if (
            $index === 0 &&
            (new finfo(FILEINFO_MIME_TYPE))->file($part["tmp_name"]) !==
                "video/mp4"
        ) {
            fail(422, "الملف المحدد ليس فيديو MP4 صالحًا.");
        }
        $cloud = integrationEnabled("s3");
        if ($cloud !== ($upload["driver"] === "s3")) {
            fail(503, "تغيّر اتصال التخزين. أعد المحاولة عند استعادته.");
        }
        $key = lessonPartName($id, $index);
        storeEncryptedObject(
            $key,
            sealLessonPart($key, file_get_contents($part["tmp_name"])),
        );
        if (($index + 1) * LESSON_VIDEO_PART < $size) {
            run(
                "UPDATE lesson_video_uploads SET received=?, expires_at=? WHERE id=?",
                [$index + 1, $expiry, $id],
            );
            return ["complete" => false, "received" => $index + 1];
        }
        $course = $upload["course_id"];
        run(
            "INSERT INTO files(id,owner_id,course_id,purpose,name,mime,bytes,storage_name,created_at) VALUES(?,?,?,'resource',?,'video/mp4',?,?,?)",
            [
                $id,
                $u["id"],
                $course,
                $upload["name"],
                $size,
                "frames1:" . $upload["driver"],
                now(),
            ],
        );
        run("DELETE FROM upload_reservations WHERE id=?", [$id]);
        run("DELETE FROM lesson_video_uploads WHERE id=?", [$id]);
        courseUpdate(
            $course,
            "file",
            $id,
            "ملف جديد: " . $upload["name"],
            "/files?course=" . $course,
        );
        audit($u, "file.uploaded", $id);
        return ["id" => $id, "name" => $upload["name"], "complete" => true];
    });
}
// Ordinary attachments use one private object containing independently authenticated frames.
const ATTACHMENT_PART = 1048576;
function storePackedAttachment(
    string $id,
    $source,
    int $size,
    ?bool $cloud = null,
): string {
    $packed = tmpfile();
    if (!$packed) {
        throw new RuntimeException("Cannot stage encrypted attachment");
    }
    try {
        for (
            $offset = 0, $i = 0;
            $offset < $size;
            $offset += ATTACHMENT_PART, $i++
        ) {
            $length = min(ATTACHMENT_PART, $size - $offset);
            $plain = fread($source, $length);
            if ($plain === false || strlen($plain) !== $length) {
                throw new RuntimeException("Incomplete attachment input");
            }
            $frame = sealLessonPart(lessonPartName($id, $i), $plain);
            if (fwrite($packed, $frame) !== strlen($frame)) {
                throw new RuntimeException("Cannot stage attachment frame");
            }
        }
        rewind($packed);
        return storeEncryptedObject(uid() . ".pack1", $packed, $cloud);
    } finally {
        fclose($packed);
    }
}

function readFileFrames(
    array $file,
    int $start,
    int $end,
    callable $consume,
): void {
    $packed = str_ends_with($file["storage_name"], ".pack1");
    $part = $packed ? ATTACHMENT_PART : LESSON_VIDEO_PART;
    $prefix = $file["storage_name"] === "frames1:s3" ? "s3:" : "";
    $last = intdiv($end, $part);
    for ($i = intdiv($start, $part); $i <= $last; $i++) {
        $base = $i * $part;
        $len = min($part, (int) $file["bytes"] - $base);
        $key = lessonPartName($file["id"], $i);
        $object = $packed ? $file["storage_name"] : $prefix . $key;
        $plain = readFileFrame(
            $key,
            $object,
            $packed ? $i * ($part + 28) : 0,
            $len,
            $packed,
        );
        $offset = max(0, $start - $base);
        $length = min($len - $offset, $end - $base - $offset + 1);
        if (
            $consume(
                $length === $len ? $plain : substr($plain, $offset, $length),
            ) === false
        ) {
            break;
        }
        unset($plain);
    }
}
// Keep the existing streaming entry point for in-flight requests across releases.
function streamLessonVideo(array $f, int $start, int $end): void
{
    readFileFrames($f, $start, $end, static function (string $chunk): bool {
        echo $chunk;
        flush();
        return !connection_aborted();
    });
}
// Reclaim abandoned uploads incrementally, including a possible last write before a rollback.
function cleanExpiredLessonParts(float $deadline): void
{
    for ($step = 0; $step < 24 && microtime(true) < $deadline; $step++) {
        $candidate = one(
            "SELECT id FROM lesson_video_uploads WHERE expires_at<? ORDER BY expires_at LIMIT 1",
            [now()],
        );
        if (!$candidate) {
            return;
        }
        tx(function () use ($candidate) {
            $id = $candidate["id"];
            lockRow("lesson_video_uploads", $id);
            $upload = one(
                "SELECT driver,received,expires_at FROM lesson_video_uploads WHERE id=?",
                [$id],
            );
            if (!$upload || $upload["expires_at"] >= now()) {
                return;
            }
            $index = (int) $upload["received"];
            discardObject(
                ($upload["driver"] === "s3" ? "s3:" : "") .
                    lessonPartName($id, $index),
            );
            if ($index > 0) {
                run("UPDATE lesson_video_uploads SET received=? WHERE id=?", [
                    $index - 1,
                    $id,
                ]);
            } else {
                run("DELETE FROM lesson_video_uploads WHERE id=?", [$id]);
                run("DELETE FROM upload_reservations WHERE id=?", [$id]);
            }
        });
    }
}
