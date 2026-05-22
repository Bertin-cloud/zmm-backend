<?php
// ── announcements/create.php ──────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);
$auth = requireAdmin();
$data = body();
$db   = getDB();

$title   = trim($data['title']   ?? '');
$message = trim($data['message'] ?? '');
$type    = $data['type'] ?? 'info';

if (!$title || !$message) error('Title and message are required');
if (!in_array($type, ['info', 'warning', 'promo'])) $type = 'info';

$stmt = $db->prepare('INSERT INTO announcements (title, message, type, author_id, author_name) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$title, $message, $type, $auth['id'], $auth['username']]);
$id = (int)$db->lastInsertId();

success([
    'announcement' => [
        'id'          => $id,
        'title'       => $title,
        'message'     => $message,
        'type'        => $type,
        'author_id'   => $auth['id'],
        'author_name' => $auth['username'],
        'created_at'  => date('Y-m-d H:i:s'),
    ],
], 'Announcement posted');
