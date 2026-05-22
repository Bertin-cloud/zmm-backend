<?php
// ── announcements/delete.php ──────────────────────────────────────────────────
require_once __DIR__ . '/../../includes/helpers.php';
setCors();
$auth = requireAdmin();
$db   = getDB();

$id = (int)($_GET['id'] ?? 0);
if (!$id) error('ID required');

$db->prepare('DELETE FROM announcements WHERE id = ?')->execute([$id]);
success([], 'Announcement deleted');
