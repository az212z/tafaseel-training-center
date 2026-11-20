CREATE TABLE IF NOT EXISTS record_trash (
    kind VARCHAR(20) NOT NULL,
    resource_id VARCHAR(40) NOT NULL,
    course_id VARCHAR(40),
    title VARCHAR(240) NOT NULL,
    previous_state VARCHAR(24),
    removed_by VARCHAR(40) NOT NULL,
    removed_at VARCHAR(30) NOT NULL,
    PRIMARY KEY (kind, resource_id),
    FOREIGN KEY (removed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS record_trash_removed ON record_trash(removed_at);
CREATE INDEX IF NOT EXISTS courses_instructor_status ON courses(instructor_id,status);
CREATE INDEX IF NOT EXISTS users_role_active ON users(role,active,created_at);
