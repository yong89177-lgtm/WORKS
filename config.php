<?php
// XAMPP 기본값입니다. 운영 환경의 MySQL 계정 정보에 맞게 값만 바꾸면 됩니다.
define('DB_HOST', 'localhost');
define('DB_NAME', 'aims');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('UPLOAD_URL', 'uploads/');
define('MAX_UPLOAD_BYTES', 5 * 1024 * 1024);
