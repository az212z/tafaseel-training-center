<?php
// Copy to config.php OUTSIDE public_html. Generate key: php -r 'echo bin2hex(random_bytes(32));'
return [
    "environment" => "production",
    "demo" => false,
    "origin" => "https://tafaseel-learn.com",
    "dsn" => "mysql:host=localhost;dbname=DATABASE;charset=utf8mb4",
    "db_user" => "DATABASE_USER",
    "db_password" => "",
    "key" => "", // 64 hex characters. Back up separately. Never change after storing data.
    "storage" => __DIR__ . "/storage",
    "enforce_staff_mfa" => true,
    "staff_mfa_enabled" => true,
    "registration_enabled" => true, // New requests stay disabled until an admin review.
    "max_upload_bytes" => 31457280,
    "storage_quota_bytes" => 2147483648, // Set an explicit quota appropriate to your plan.
    "max_video_upload_bytes" => 10737418240,
    "integrations" => [
        "moyasar" => ["enabled" => false, "mode" => "test", "secret_key" => ""],
        "sms" => ["enabled" => false, "token" => "", "sender" => ""],
        "zoom" => [
            "enabled" => false,
            "account_id" => "",
            "client_id" => "",
            "client_secret" => "",
            "webhook_secret" => "",
            "default_host" => "",
        ],
        "video" => [
            "enabled" => false,
            "library_id" => "",
            "api_key" => "",
            "token_key" => "",
        ],
        "s3" => [
            "enabled" => false,
            "bucket" => "",
            "region" => "auto",
            "endpoint" => "",
            "access_key" => "",
            "secret_key" => "",
        ],
    ],
];
