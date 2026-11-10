<?php
declare(strict_types=1);
require __DIR__ . '/../account_lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
account_boot($method !== 'GET');
try {
    if ($method === 'GET') {
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
        $rows = db()->query("SELECT * FROM kiriman_harga WHERE status_verifikasi <> 'ditolak' ORDER BY waktu_kirim DESC, id DESC LIMIT $limit")->fetchAll();
        $ids = array_map(fn($r) => (int)$r['id'], $rows);
        $comments = []; $replies = [];
        if ($ids) {
            $in = implode(',', $ids);
            foreach (db()->query("SELECT * FROM komentar WHERE kiriman_id IN ($in) ORDER BY waktu_kirim, id")->fetchAll() as $c) $comments[(int)$c['kiriman_id']][] = $c;
            $cids = [];
            foreach ($comments as $list) foreach ($list as $c) $cids[] = (int)$c['id'];
            if ($cids) {
                $cin = implode(',', $cids);
                foreach (db()->query("SELECT * FROM balasan WHERE komentar_id IN ($cin) ORDER BY waktu_kirim, id")->fetchAll() as $r) $replies[(int)$r['komentar_id']][] = $r;
            }
        }
        $out = array_map(function ($r) use ($comments, $replies) {
            $id = (int)$r['id'];
            return [
                'id' => (string)$id, 'name' => $r['nama_kontributor'], 'commodity' => $r['komoditas'], 'price' => (int)$r['harga'],
                'unit' => $r['satuan'], 'seller' => $r['jenis_tempat'], 'marketName' => $r['nama_pasar_toko'], 'region' => $r['provinsi'],
                'date' => $r['tanggal_pengamatan'], 'notes' => $r['catatan'], 'proof' => photo_url($r['foto_path']),
                'status' => $r['status_verifikasi'], 'createdAt' => iso($r['waktu_kirim']), 'ownerId' => isset($r['pengguna_id']) ? (int)$r['pengguna_id'] : null,
                'comments' => array_map(fn($c) => [
                    'id' => (string)$c['id'], 'author' => $c['nama'], 'text' => $c['isi'], 'createdAt' => iso($c['waktu_kirim']),
                    'replies' => array_map(fn($b) => ['id' => (string)$b['id'], 'author' => $b['nama'], 'text' => $b['isi'], 'createdAt' => iso($b['waktu_kirim'])], $replies[(int)$c['id']] ?? []),
                ], $comments[$id] ?? []),
            ];
        }, $rows);
        json_out(['ok' => true, 'items' => $out]);
    }

    if ($method === 'POST') {
        $user = require_user();
        $in = read_json();
        $name = mb_substr((string)$user['nama'], 0, 48); // nama dari akun, bukan isian bebas
        $commodity = text_field($in, 'commodity', 60);
        $seller = text_field($in, 'seller', 20);
        if (!in_array($seller, ['Pasar tradisional', 'Supermarket'], true)) json_out(['ok' => false, 'error' => 'Jenis tempat tidak valid.'], 422);
        $market = text_field($in, 'marketName', 80);
        $region = text_field($in, 'region', 60);
        $unit = text_field($in, 'unit', 16);
        $notes = text_field($in, 'notes', 240, false);
        $price = (int)($in['price'] ?? 0);
        if ($price < 500 || $price > 100000000) json_out(['ok' => false, 'error' => 'Harga minimal Rp500.'], 422);
        $date = (string)($in['date'] ?? '');
        $d = DateTime::createFromFormat('Y-m-d', $date);
        if (!$d || $d->format('Y-m-d') !== $date || $d > new DateTime('tomorrow')) json_out(['ok' => false, 'error' => 'Tanggal pengamatan tidak valid.'], 422);
        $photo = save_photo(isset($in['proof']) ? (string)$in['proof'] : null);
        $token = bin2hex(random_bytes(24));
        $st = db()->prepare('INSERT INTO kiriman_harga (pengguna_id, nama_kontributor, komoditas, harga, satuan, jenis_tempat, nama_pasar_toko, provinsi, tanggal_pengamatan, catatan, foto_path, delete_token_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $st->execute([(int)$user['id'], $name, $commodity, $price, $unit, $seller, $market, $region, $date, $notes, $photo, hash('sha256', $token)]);
        json_out(['ok' => true, 'id' => (string)db()->lastInsertId(), 'deleteToken' => $token, 'status' => 'belum_diverifikasi'], 201);
    }

    if ($method === 'DELETE') {
        $user = require_user();
        $id = (int)($_GET['id'] ?? 0);
        $st = db()->prepare('SELECT foto_path, pengguna_id FROM kiriman_harga WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row || (int)$row['pengguna_id'] !== (int)$user['id']) json_out(['ok' => false, 'error' => 'Kiriman tidak ditemukan atau bukan milik Anda.'], 403);
        db()->prepare('DELETE FROM kiriman_harga WHERE id = ?')->execute([$id]);
        if ($row['foto_path']) @unlink(rtrim(config()['upload_dir'], '/\\') . '/' . $row['foto_path']);
        json_out(['ok' => true]);
    }

    json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
} catch (PDOException $e) {
    error_log('[pangan-pas] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'Database tidak dapat diakses.'], 500);
}
