CREATE TABLE IF NOT EXISTS course_registration_requests (
    student_id VARCHAR(40) NOT NULL,
    course_id VARCHAR(40) NOT NULL,
    created_at VARCHAR(30) NOT NULL,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS course_registration_created ON course_registration_requests(created_at);
