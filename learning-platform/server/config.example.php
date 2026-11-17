<?php
// Copy to config.php OUTSIDE public_html. Generate key: php -r 'echo bin2hex(random_bytes(32));'
return [
    "environment" => "production",
    "demo" => false,
    "origin" => "https://learn.tafaseel-training.com",
    "dsn" => "mysql:host=localhost;dbname=DATABASE;charset=utf8mb4",
    "db_user" => "DATABASE_USER",
    "db_password" => "",
    "key" => "", // 64 hex characters. Back up separately. Never change after storing data.
    "storage" => __DIR__ . "/storage",
];
