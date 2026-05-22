<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);

$data = body();
$username = trim($data['username'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (!$username || !$email || !$password) error('Username, email and password are required');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error('Invalid email address');

$db = getDB();
$check = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
$check->execute([$username, $email]);
if ($check->fetch()) error('Username or email already exists', 409);

$passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$stmt = $db->prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
$stmt->execute([$username, $email, $passwordHash, 'participant']);
$userId = (int)$db->lastInsertId();

$token = jwtEncode(['id' => $userId, 'username' => $username, 'role' => 'participant']);

success([
    'user' => [
        'id' => $userId,
        'username' => $username,
        'email' => $email,
        'role' => 'participant',
        'token' => $token,
    ],
], 'Registration successful');
