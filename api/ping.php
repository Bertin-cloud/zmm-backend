<?php
// Try to locate the includes/helpers.php file in a few common relative locations
$candidates = [
    __DIR__ . '/../../includes/helpers.php',    // default: backend/api -> backend/includes
    __DIR__ . '/../includes/helpers.php',      // alternative: backend/api -> includes (if copied differently)
    __DIR__ . '/includes/helpers.php',         // api/includes (less likely)
    __DIR__ . '/../../../includes/helpers.php' // one level up (for different layouts)
];

$found = null;
foreach ($candidates as $p) {
    if (file_exists($p)) { $found = $p; break; }
}

if (!$found) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'helpers.php not found. Make sure the full backend folder (includes/, config/, api/) is copied to the web server.']);
    exit;
}

require_once $found;
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

success(['uptime' => time(), 'status' => 'ok'], 'pong');
