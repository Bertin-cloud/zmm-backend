<?php
// ── meetings/list.php ─────────────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();
requireAuth();

$db   = getDB();
$stmt = $db->query("
    SELECT m.*, u.username AS host_name,
        (SELECT COUNT(*) FROM participants p WHERE p.meeting_id = m.meeting_id AND p.left_at IS NULL) AS participant_count
    FROM meetings m
    JOIN users u ON u.id = m.host_id
    WHERE m.status != 'ended'
    ORDER BY m.created_at DESC
    LIMIT 100
");
$meetings = $stmt->fetchAll();

success(['meetings' => $meetings]);
