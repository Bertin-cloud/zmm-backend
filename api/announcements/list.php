<?php
// ── announcements/list.php ────────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

$db   = getDB();
$stmt = $db->query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50');
success(['announcements' => $stmt->fetchAll()]);
