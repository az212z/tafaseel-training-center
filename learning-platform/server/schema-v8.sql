CREATE TABLE IF NOT EXISTS quiz_answer_drafts (attempt_id VARCHAR(40) PRIMARY KEY, answers TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, saved_at VARCHAR(30) NOT NULL, FOREIGN KEY(attempt_id) REFERENCES attempts(id));
CREATE TABLE IF NOT EXISTS sms_attempts (id VARCHAR(40) PRIMARY KEY, message_id VARCHAR(40) NOT NULL, created_at VARCHAR(30) NOT NULL, FOREIGN KEY(message_id) REFERENCES notification_outbox(id));
CREATE INDEX IF NOT EXISTS sms_attempts_created ON sms_attempts(created_at);
