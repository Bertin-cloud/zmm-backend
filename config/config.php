<?php
// ── Database Configuration ────────────────────────────────────────────────────
// ⚠️  Change these to your server credentials
define('DB_HOST', 'localhost');
define('DB_NAME', 'zmm_db');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// ── App Config ────────────────────────────────────────────────────────────────
define('APP_NAME', 'ZMM');
define('APP_URL',  'https://your-server.com/zmm');
define('JWT_SECRET', 'zmm_super_secret_key_change_this_in_production');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// ── LiveKit Config ────────────────────────────────────────────────────────────
define('LIVEKIT_URL',        'wss://your-livekit.livekit.cloud');
define('LIVEKIT_API_KEY',    'your_livekit_api_key');
define('LIVEKIT_API_SECRET', 'your_livekit_api_secret');

// ── Admin Credentials ─────────────────────────────────────────────────────────
define('ADMIN_USERNAME', 'Bertin');
define('ADMIN_PASSWORD', 'Bertin@1234567890');

// ── DB Connection ─────────────────────────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
