<?php

// ── DATABASE (ONLY LOCAL OR HOSTED MYSQL) ───────────────────────
// If you deploy backend, change this to hosted DB (important)
define('DB_HOST', 'localhost');
define('DB_NAME', 'zmm_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// ── APP CONFIG ───────────────────────────────────────────────────
define('APP_NAME', 'ZMM');
define('APP_URL', 'https://zmm-backend.onrender.com');

define('JWT_SECRET', 'change_this_to_a_long_random_secret');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// ── LIVEKIT CONFIG (IMPORTANT) ───────────────────────────────────
// YOU MUST REPLACE THESE FROM LIVEKIT DASHBOARD
define('LIVEKIT_URL', 'wss://conference-hbqz5vdt.livekit.cloud');
define('LIVEKIT_API_KEY', 'APIPF4uEDAnnGcQ');
define('LIVEKIT_API_SECRET', 'LGZEqkjPlUgnUPNS5nSaBcZy6gnxQT0xbK6HaSZOhAC');

// ── ADMIN LOGIN ──────────────────────────────────────────────────
define('ADMIN_USERNAME', 'Bertin');
define('ADMIN_PASSWORD', 'Bertin@1234567890');

// ── DATABASE CONNECTION ──────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }

    return $pdo;
}