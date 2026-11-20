CREATE TABLE IF NOT EXISTS lesson_video_uploads (
    id VARCHAR(40) PRIMARY KEY,
    owner_id VARCHAR(40) NOT NULL,
    course_id VARCHAR(40) NOT NULL,
    name VARCHAR(180) NOT NULL,
    bytes BIGINT NOT NULL,
    driver VARCHAR(12) NOT NULL,
    received INTEGER NOT NULL DEFAULT 0,
    expires_at VARCHAR(30) NOT NULL
);
CREATE INDEX IF NOT EXISTS lesson_upload_expiry ON lesson_video_uploads(expires_at);
