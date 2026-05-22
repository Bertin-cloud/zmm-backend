<?php
// ── meetings/join.php ─────────────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);

$data = body();
$db   = getDB();

$meetingId = trim($data['meeting_id'] ?? '');
$password  = trim($data['password']   ?? '');
$name      = trim($data['name']       ?? '');

if (!$meetingId || !$password || !$name) error('Meeting ID, password and name are required');

// Find meeting
$stmt = $db->prepare("SELECT * FROM meetings WHERE meeting_id = ? AND status != 'ended'");
$stmt->execute([$meetingId]);
$meeting = $stmt->fetch();

if (!$meeting)                       error('Meeting not found or has ended', 404);
if ($meeting['password'] !== $password) error('Incorrect meeting password', 401);

// Get auth if logged in
$userId = null;
$auth   = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (str_starts_with($auth, 'Bearer ')) {
    $payload = jwtDecode(substr($auth, 7));
    if ($payload) $userId = $payload['id'];
}

// Determine role
$role = 'participant';
if ($userId && $userId == $meeting['host_id']) $role = 'host';

// Log participant
$pStmt = $db->prepare('INSERT INTO participants (meeting_id, user_id, name, role) VALUES (?, ?, ?, ?)');
$pStmt->execute([$meetingId, $userId, $name, $role]);

// Set meeting to live if waiting
if ($meeting['status'] === 'waiting') {
    $db->prepare('UPDATE meetings SET status = ?, started_at = NOW() WHERE meeting_id = ?')
       ->execute(['live', $meetingId]);
}

// Participant count
$countStmt = $db->prepare('SELECT COUNT(*) FROM participants WHERE meeting_id = ? AND left_at IS NULL');
$countStmt->execute([$meetingId]);
$count = (int)$countStmt->fetchColumn();

// Generate LiveKit token
$livekitToken = generateLiveKitToken($meeting['livekit_room'] ?? $meetingId, $name, $role === 'host');

// Host name
$hostStmt = $db->prepare('SELECT username FROM users WHERE id = ?');
$hostStmt->execute([$meeting['host_id']]);
$host = $hostStmt->fetch();

success([
    'token' => $livekitToken,
    'meeting' => [
        'id'                => $meeting['id'],
        'meeting_id'        => $meeting['meeting_id'],
        'password'          => $meeting['password'],
        'title'             => $meeting['title'],
        'topic'             => $meeting['topic'],
        'host_id'           => $meeting['host_id'],
        'host_name'         => $host['username'] ?? 'Host',
        'type'              => $meeting['type'],
        'status'            => 'live',
        'participant_count' => $count,
        'parent_meeting_id' => $meeting['parent_meeting_id'],
    ],
    'role' => $role,
], 'Joined meeting');
