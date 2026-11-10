<?php
declare(strict_types=1);
require __DIR__ . '/../account_lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
account_boot(true);
if ($method !== 'POST') json_out(['ok' => false, 'error' => 'Metode tidak didukung.'], 405);
$action = (string)($_GET['action'] ?? '');

function valid_province($p): string {
    $p = trim((string)$p);
    if (!in_array($p, PROVINCES, true)) json_out(['ok' => false, 'error' => 'Provinsi tidak dikenal.'], 422);
    return $p;
}

try {
    $u = require_user();
    $uid = (int)$u['id'];
    $in = read_json();
    $pdo = db();

    switch ($action) {
        case 'update':
            $nama = clean_name($in['nama'] ?? '');
            $username = clean_username($in['username'] ?? '');
            if (username_taken($username, $uid)) json_out(['ok' => false, 'error' => 'Username sudah dipakai.', 'field' => 'username'], 409);
            $pdo->prepare('UPDATE pengguna SET nama = ?, username = ? WHERE id = ?')->execute([$nama, $username, $uid]);
            break;

        case 'password':
            $hash = (string)($u['password_hash'] ?? '');
            if ($hash !== '') {
                if (too_many_attempts()) json_out(['ok' => false, 'error' => 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'], 429);
                if (!password_verify((string)($in['lama'] ?? ''), $hash)) {
                    record_attempt();
                    json_out(['ok' => false, 'error' => 'Password lama salah.', 'field' => 'lama'], 401);
                }
            }
            $new = check_password($in['baru'] ?? '', $in['konfirmasi'] ?? '');
            $pdo->prepare('UPDATE pengguna SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $uid]);
            session_regenerate_id(true);
            break;

        case 'prefs':
            $sets = []; $vals = [];
            if (array_key_exists('tema', $in)) { $sets[] = 'tema = ?'; $vals[] = $in['tema'] === 'dark' ? 'gelap' : 'terang'; }
            if (array_key_exists('notifikasiHarga', $in)) { $sets[] = 'notifikasi_harga = ?'; $vals[] = $in['notifikasiHarga'] ? 1 : 0; }
            if (array_key_exists('aksesLokasi', $in)) { $sets[] = 'akses_lokasi = ?'; $vals[] = $in['aksesLokasi'] ? 1 : 0; }
            if ($sets) { $vals[] = $uid; $pdo->prepare('UPDATE pengguna SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals); }
            break;

        case 'favorit-tambah':
            $st = $pdo->prepare('SELECT COUNT(*) FROM lokasi_favorit WHERE pengguna_id = ?');
            $st->execute([$uid]);
            if ((int)$st->fetchColumn() >= 38) json_out(['ok' => false, 'error' => 'Batas lokasi favorit tercapai.'], 422);
            $pdo->prepare('INSERT IGNORE INTO lokasi_favorit (pengguna_id, provinsi) VALUES (?, ?)')->execute([$uid, valid_province($in['provinsi'] ?? '')]);
            break;

        case 'favorit-hapus':
            $pdo->prepare('DELETE FROM lokasi_favorit WHERE pengguna_id = ? AND provinsi = ?')->execute([$uid, valid_province($in['provinsi'] ?? '')]);
            break;

        case 'favorit-gabung':
            $list = is_array($in['daftar'] ?? null) ? array_slice($in['daftar'], 0, 38) : [];
            $st = $pdo->prepare('INSERT IGNORE INTO lokasi_favorit (pengguna_id, provinsi) VALUES (?, ?)');
            foreach ($list as $p) if (in_array($p, PROVINCES, true)) $st->execute([$uid, $p]);
            break;

        default:
            json_out(['ok' => false, 'error' => 'Aksi tidak dikenal.'], 400);
    }
    json_out(['ok' => true, 'user' => user_public(current_user())]);
} catch (PDOException $e) {
    error_log('[pangan-pas profil] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'Server database sedang bermasalah.'], 500);
}
