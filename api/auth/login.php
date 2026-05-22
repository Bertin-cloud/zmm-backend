<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);

$data = body();
$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

if (!$username || !$password) error('Username and password are required');

$db = getDB();

// Hardcoded admin shortcut removed. Use regular DB users or register an admin via the DB.

// ── Regular user login ────────────────────────────────────────────────────────
$stmt = $db->prepare('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$username, $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    error('Invalid username or password', 401);
}

$token = jwtEncode(['id' => $user['id'], 'username' => $user['username'], 'role' => $user['role']]);

success([
    'user' => [
        'id'        => $user['id'],
        'username'  => $user['username'],
        'email'     => $user['email'],
        'role'      => $user['role'],
        'avatar_url'=> $user['avatar_url'],
        'token'     => $token,
    ],
], 'Login successful');

