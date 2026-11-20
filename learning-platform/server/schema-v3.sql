CREATE TABLE IF NOT EXISTS website_inquiries (id VARCHAR(40) PRIMARY KEY, reference VARCHAR(30) NOT NULL UNIQUE, kind VARCHAR(20) NOT NULL, program_slug VARCHAR(100) NOT NULL, payload TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'new', created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL);
CREATE INDEX IF NOT EXISTS idx_website_inquiries_status ON website_inquiries(status,created_at);
CREATE TABLE IF NOT EXISTS website_content (id VARCHAR(40) PRIMARY KEY, payload LONGTEXT NOT NULL);
