CREATE TABLE IF NOT EXISTS account_supervisors (
    user_id VARCHAR(40) PRIMARY KEY,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
