<?php
// Login state lives in a server-side PHP session. The browser only holds the session-ID cookie,
// which is HttpOnly (unreadable by JavaScript), SameSite and Secure in production.
// No password or login token is ever returned to the browser.
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

const COMMODITIES = ['Beras medium', 'Beras premium', 'Gula pasir', 'Minyak goreng', 'Telur ayam', 'Daging ayam ras',
    'Daging sapi', 'Bawang merah', 'Bawang putih', 'Cabai merah', 'Cabai rawit merah', 'Jagung pipilan'];
const PROVINCES = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung',
    'Kep. Bangka Belitung', 'Kep. Riau', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
    'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan',
    'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara',
    'Gorontalo', 'Sulawesi Barat', 'Maluku', 'Maluku Utara', 'Papua Barat', 'Papua Barat Daya', 'Papua', 'Papua Tengah',
    'Papua Pegunungan', 'Papua Selatan'];

function acfg(string $key, $default = null) {
    $c = config();
    return array_key_exists($key, $c) ? $c[$key] : $default;
}

// When proxy_secret is set, every request must carry it, so the API cannot be called directly.
function from_trusted_proxy(): bool {
    $secret = (string)acfg('proxy_secret', '');
    return $secret !== '' && hash_equals($secret, (string)($_SERVER['HTTP_X_PANGAN_PROXY'] ?? ''));
}

function account_boot(bool $stateChanging = false): void {
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $secret = (string)acfg('proxy_secret', '');
    if ($secret !== '' && !from_trusted_proxy()) json_out(['ok' => false, 'error' => 'Akses langsung tidak diizinkan.'], 403);

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, acfg('allowed_origins', []), true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Pangan-Request');
        header('Access-Control-Max-Age: 600');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

    // CSRF guard: state-changing calls must send a custom header (cross-site forms cannot set it).
    if ($stateChanging && ($_SERVER['HTTP_X_PANGAN_REQUEST'] ?? '') !== '1') {
        json_out(['ok' => false, 'error' => 'Permintaan ditolak.'], 403);
    }
    start_account_session();
}

function start_account_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $days = (int)acfg('session_days', 14);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)($days * 86400));
    session_name('PPSESS');
    session_set_cookie_params([
        'lifetime' => $days * 86400,
        'path' => '/',
        'secure' => (bool)acfg('cookie_secure', true),
        'httponly' => true,
        'samesite' => (string)acfg('cookie_samesite', 'Lax'),
    ]);
    session_start();
}

function client_ip(): string {
    if (from_trusted_proxy() && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $first = trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function too_many_attempts(): bool {
    $st = db()->prepare('SELECT COUNT(*) FROM percobaan_login WHERE ip = ? AND waktu > (NOW() - INTERVAL 15 MINUTE)');
    $st->execute([client_ip()]);
    return (int)$st->fetchColumn() >= 10;
}
function record_attempt(): void {
    db()->prepare('INSERT INTO percobaan_login (ip) VALUES (?)')->execute([client_ip()]);
    if (random_int(1, 50) === 1) db()->exec('DELETE FROM percobaan_login WHERE waktu < (NOW() - INTERVAL 1 DAY)');
}
function clear_attempts(): void {
    db()->prepare('DELETE FROM percobaan_login WHERE ip = ?')->execute([client_ip()]);
}

function current_user(): ?array {
    $uid = (int)($_SESSION['uid'] ?? 0);
    if ($uid <= 0) return null;
    $st = db()->prepare('SELECT * FROM pengguna WHERE id = ?');
    $st->execute([$uid]);
    $row = $st->fetch();
    if (!$row) { unset($_SESSION['uid']); return null; }
    return $row;
}
function require_user(): array {
    $u = current_user();
    if (!$u) json_out(['ok' => false, 'error' => 'Silakan masuk terlebih dahulu.'], 401);
    return $u;
}

function login_user(int $id): void {
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    db()->prepare('UPDATE pengguna SET login_terakhir = NOW() WHERE id = ?')->execute([$id]);
}
function logout_user(): void {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => $p['samesite'] ?: 'Lax']);
        session_destroy();
    }
}

function user_public(array $u): array {
    $st = db()->prepare('SELECT provinsi FROM lokasi_favorit WHERE pengguna_id = ? ORDER BY dibuat, id');
    $st->execute([(int)$u['id']]);
    return [
        'id' => (int)$u['id'],
        'nama' => $u['nama'],
        'username' => $u['username'],
        'email' => $u['email'],
        'tema' => $u['tema'] === 'gelap' ? 'dark' : 'light',
        'notifikasiHarga' => (bool)$u['notifikasi_harga'],
        'aksesLokasi' => (bool)$u['akses_lokasi'],
        'punyaPassword' => $u['password_hash'] !== null && $u['password_hash'] !== '',
        'favorit' => array_column($st->fetchAll(), 'provinsi'),
    ];
}


function clean_name($v): string {
    $v = trim(preg_replace('/\s+/u', ' ', preg_replace('/[\x00-\x1F\x7F]/u', '', (string)$v) ?? '') ?? '');
    if (mb_strlen($v) < 2) json_out(['ok' => false, 'error' => 'Nama minimal 2 karakter.', 'field' => 'nama'], 422);
    if (mb_strlen($v) > 80) json_out(['ok' => false, 'error' => 'Nama maksimal 80 karakter.'], 422);
    return $v;
}
function clean_username($v): string {
    $v = strtolower(trim((string)$v));
    $v = preg_replace('/\s+/', '_', $v) ?? '';
    if (!preg_match('/^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/', $v) || strpos($v, '..') !== false) {
        json_out(['ok' => false, 'error' => 'Username 3–30 karakter, diawali dan diakhiri huruf/angka; boleh titik, - dan _.', 'field' => 'username'], 422);
    }
    return $v;
}
function clean_email($v): string {
    $v = strtolower(trim((string)$v));
    if (strlen($v) > 190 || !filter_var($v, FILTER_VALIDATE_EMAIL)) json_out(['ok' => false, 'error' => 'Alamat email tidak valid.', 'field' => 'email'], 422);
    return $v;
}
function check_password($v, $confirm): string {
    $v = (string)$v;
    if (strlen($v) < 8) json_out(['ok' => false, 'error' => 'Password minimal 8 karakter.', 'field' => 'password'], 422);
    if (strlen($v) > 72) json_out(['ok' => false, 'error' => 'Password maksimal 72 karakter.', 'field' => 'password'], 422);
    if (!hash_equals($v, (string)$confirm)) json_out(['ok' => false, 'error' => 'Konfirmasi password tidak sama.', 'field' => 'konfirmasi'], 422);
    return $v;
}
function username_taken(string $username, int $exceptId = 0): bool {
    $st = db()->prepare('SELECT 1 FROM pengguna WHERE username = ? AND id <> ?');
    $st->execute([$username, $exceptId]);
    return (bool)$st->fetchColumn();
}
