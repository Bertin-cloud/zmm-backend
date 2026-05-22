<?php
require_once __DIR__ . '/../config/config.php';

// ── CORS Headers ──────────────────────────────────────────────────────────────
function setCors(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
    header('Content-Type: application/json; charset=utf-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
}

// ── JSON Response ─────────────────────────────────────────────────────────────
function respond(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function success(array $data = [], string $message = 'OK'): never {
    respond(array_merge(['success' => true, 'message' => $message], $data));
}

function error(string $message, int $code = 400): never {
    respond(['success' => false, 'message' => $message], $code);
}

// ── Request Body ──────────────────────────────────────────────────────────────
function body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ── JWT (simple implementation) ───────────────────────────────────────────────
function jwtEncode(array $payload): string {
    $header  = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;
    $payload = base64url(json_encode($payload));
    $sig     = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwtDecode(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data;
}

function base64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// ── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(): array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) error('Unauthorized', 401);
    $token = substr($auth, 7);

    // Check admin token first
    $payload = jwtDecode($token);
    if (!$payload) error('Invalid or expired token', 401);

    return $payload;
}

function requireAdmin(): array {
    $auth = requireAuth();
    if (($auth['role'] ?? '') !== 'admin') error('Admin access required', 403);
    return $auth;
}

// ── Meeting ID Generator ──────────────────────────────────────────────────────
function generateMeetingId(): string {
    do {
        $id = sprintf('%03d-%03d-%04d', random_int(100, 999), random_int(100, 999), random_int(1000, 9999));
        $exists = getDB()->prepare('SELECT id FROM meetings WHERE meeting_id = ?');
        $exists->execute([$id]);
    } while ($exists->fetch());
    return $id;
}

// ── LiveKit Token Generator ───────────────────────────────────────────────────
function generateLiveKitToken(string $roomName, string $participantName, bool $isHost = false): string {
    // LiveKit JWT structure
    $grants = [
        'video' => [
            'room'      => $roomName,
            'roomJoin'  => true,
            'canPublish' => true,
            'canSubscribe' => true,
            'roomAdmin'  => $isHost,
        ],
    ];

    $header  = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url(json_encode([
        'iss'    => LIVEKIT_API_KEY,
        'sub'    => $participantName,
        'iat'    => time(),
        'exp'    => time() + 3600, // 1 hour meeting token
        'video'  => $grants['video'],
        'name'   => $participantName,
        'metadata' => json_encode(['host' => $isHost]),
    ]));
    $sig = base64url(hash_hmac('sha256', "$header.$payload", LIVEKIT_API_SECRET, true));
    return "$header.$payload.$sig";
}
