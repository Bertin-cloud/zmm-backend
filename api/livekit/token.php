<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);

$data = body();
$room = trim($data['room'] ?? '');
$participant = trim($data['participant'] ?? '');
$isHost = filter_var($data['is_host'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!$room || !$participant) error('Room and participant are required');

$token = generateLiveKitToken($room, $participant, $isHost);

success(['token' => $token], 'LiveKit token generated');
