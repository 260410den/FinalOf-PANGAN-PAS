<?php
declare(strict_types=1);

function config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) { json_out(['ok' => false, 'error' => 'config.php belum dibuat. Salin config.example.php.'], 500); }
        $cfg = require $file;
    }
    return $cfg;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $c = config();
        $pdo = new PDO("mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4", $c['db_user'], $c['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function cors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, config()['allowed_origins'], true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

function json_out(array $body, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json(): array {
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > 4 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Data terlalu besar.'], 413);
    $data = json_decode($raw, true);
    if (!is_array($data)) json_out(['ok' => false, 'error' => 'Format JSON tidak valid.'], 400);
    return $data;
}

function text_field(array $src, string $key, int $max, bool $required = true): ?string {
    $v = isset($src[$key]) ? trim((string)$src[$key]) : '';
    $v = preg_replace('/[\x00-\x1F\x7F]/u', '', $v) ?? '';
    if ($v === '') {
        if ($required) json_out(['ok' => false, 'error' => "Kolom $key wajib diisi."], 422);
        return null;
    }
    if (mb_strlen($v) > $max) json_out(['ok' => false, 'error' => "Kolom $key maksimal $max karakter."], 422);
    return $v;
}

function save_photo(?string $dataUrl): ?string {
    if ($dataUrl === null || $dataUrl === '') return null;
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $m)) {
        json_out(['ok' => false, 'error' => 'Foto harus berupa JPG, PNG, atau WebP.'], 422);
    }
    $bin = base64_decode($m[2], true);
    $c = config();
    if ($bin === false || strlen($bin) > $c['max_photo_bytes']) json_out(['ok' => false, 'error' => 'Foto tidak valid atau terlalu besar.'], 422);
    $info = @getimagesizefromstring($bin);
    $allowed = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($allowed[$info[2]])) json_out(['ok' => false, 'error' => 'Isi file bukan gambar yang didukung.'], 422);
    $dir = rtrim($c['upload_dir'], '/\\') . '/' . date('Y/m');
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) json_out(['ok' => false, 'error' => 'Folder upload tidak bisa dibuat.'], 500);
    $name = date('Y/m') . '/' . bin2hex(random_bytes(16)) . '.' . $allowed[$info[2]];
    if (file_put_contents(rtrim($c['upload_dir'], '/\\') . '/' . $name, $bin) === false) json_out(['ok' => false, 'error' => 'Foto gagal disimpan.'], 500);
    return $name;
}

function photo_url(?string $path): ?string {
    return $path ? rtrim(config()['upload_url'], '/') . '/' . $path : null;
}

function iso(?string $mysqlDatetime): ?string {
    return $mysqlDatetime ? date('c', strtotime($mysqlDatetime)) : null;
}
