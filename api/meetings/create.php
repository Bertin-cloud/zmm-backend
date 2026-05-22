<?php
// ── meetings/create.php ───────────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);

$auth  = requireAuth();
$data  = body();
$db    = getDB();

$title    = trim($data['title'] ?? '');
$password = trim($data['password'] ?? '');
$type     = $data['type'] ?? 'main';
$topic    = trim($data['topic'] ?? '') ?: null;
$parentId = trim($data['parent_meeting_id'] ?? '') ?: null;

if (!$title)    error('Title is required');
if (!$password) error('Password is required');
if (!in_array($type, ['main', 'breakout', 'webinar'])) error('Invalid meeting type');

$meetingId    = generateMeetingId();
$livekitRoom  = 'zmm-' . $meetingId;

$stmt = $db->prepare('
    INSERT INTO meetings (meeting_id, password, title, topic, host_id, type, status, parent_meeting_id, livekit_room)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
');
$stmt->execute([$meetingId, $password, $title, $topic, $auth['id'], $type, 'waiting', $parentId, $livekitRoom]);
$id = (int)$db->lastInsertId();

// Log host as participant
$pStmt = $db->prepare('INSERT INTO participants (meeting_id, user_id, name, role) VALUES (?, ?, ?, ?)');
$pStmt->execute([$meetingId, $auth['id'], $auth['username'], 'host']);

// Generate LiveKit token for host
$livekitToken = generateLiveKitToken($livekitRoom, $auth['username'], true);

success([
    'meeting' => [
        'id'                => $id,
        'meeting_id'        => $meetingId,
        'password'          => $password,
        'title'             => $title,
        'topic'             => $topic,
        'host_id'           => $auth['id'],
        'host_name'         => $auth['username'],
        'type'              => $type,
        'status'            => 'live',
        'participant_count' => 1,
        'livekit_room'      => $livekitRoom,
        'parent_meeting_id' => $parentId,
    ],
    'livekit_token' => $livekitToken,
    'token' => $livekitToken,
], 'Meeting created');
