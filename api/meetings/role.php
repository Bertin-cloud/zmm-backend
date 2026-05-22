<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);

$auth = requireAuth();
$data = body();
$meetingId = trim($data['meeting_id'] ?? '');
$targetUserId = (int)($data['user_id'] ?? 0);
$role = trim($data['role'] ?? '');

if (!$meetingId || !$targetUserId || !$role) error('Missing parameters', 400);

$db = getDB();
$stmt = $db->prepare('SELECT host_id FROM meetings WHERE meeting_id = ?');
$stmt->execute([$meetingId]);
$meeting = $stmt->fetch();
if (!$meeting) error('Meeting not found', 404);

// Only meeting host or admin can change roles
if (($auth['role'] ?? '') !== 'admin' && ($auth['id'] ?? 0) != $meeting['host_id']) error('Not authorized', 403);

$validRoles = ['participant', 'host', 'co-host'];
if (!in_array($role, $validRoles)) error('Invalid role', 400);

$up = $db->prepare('UPDATE participants SET role = ? WHERE meeting_id = ? AND user_id = ?');
$up->execute([$role, $meetingId, $targetUserId]);

if ($up->rowCount() === 0) {
    // If participant row doesn't exist, insert it from users table
    $ins = $db->prepare('INSERT INTO participants (meeting_id, user_id, name, role) SELECT ?, id, username, ? FROM users WHERE id = ?');
    $ins->execute([$meetingId, $role, $targetUserId]);
}

success(['updated' => true], 'Participant role updated');
