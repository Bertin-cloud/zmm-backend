<?php
// ── meetings/delete.php ───────────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();
$auth = requireAuth();
$db   = getDB();

$meetingId = $_GET['meeting_id'] ?? '';
if (!$meetingId) error('Meeting ID required');

$stmt = $db->prepare('SELECT host_id FROM meetings WHERE meeting_id = ?');
$stmt->execute([$meetingId]);
$meeting = $stmt->fetch();

if (!$meeting) error('Meeting not found', 404);
if ($meeting['host_id'] != $auth['id'] && $auth['role'] !== 'admin') error('Not authorized', 403);

$db->prepare("UPDATE meetings SET status = 'ended', ended_at = NOW() WHERE meeting_id = ?")
   ->execute([$meetingId]);

success([], 'Meeting ended');
