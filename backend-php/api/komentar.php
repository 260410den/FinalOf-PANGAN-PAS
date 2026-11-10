<?php
declare(strict_types=1);
require __DIR__ . '/../account_lib.php';
account_boot(true);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
try {
    $user = require_user();
    $in = read_json();
    $author = mb_substr((string)$user['nama'], 0, 48);
    $text = text_field($in, 'text', 240);
    if (!empty($in['reply'])) {
        $commentId = (int)($in['komentar_id'] ?? 0);
        $ok = db()->prepare('SELECT 1 FROM komentar WHERE id = ?'); $ok->execute([$commentId]);
        if (!$ok->fetch()) json_out(['ok' => false, 'error' => 'Komentar tidak ditemukan.'], 404);
        db()->prepare('INSERT INTO balasan (komentar_id, pengguna_id, nama, isi) VALUES (?,?,?,?)')->execute([$commentId, (int)$user['id'], $author, $text]);
    } else {
        $postId = (int)($in['kiriman_id'] ?? 0);
        $ok = db()->prepare('SELECT 1 FROM kiriman_harga WHERE id = ?'); $ok->execute([$postId]);
        if (!$ok->fetch()) json_out(['ok' => false, 'error' => 'Kiriman tidak ditemukan.'], 404);
        db()->prepare('INSERT INTO komentar (kiriman_id, pengguna_id, nama, isi) VALUES (?,?,?,?)')->execute([$postId, (int)$user['id'], $author, $text]);
    }
    json_out(['ok' => true, 'id' => (string)db()->lastInsertId()], 201);
} catch (PDOException $e) {
    error_log('[pangan-pas] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'Database tidak dapat diakses.'], 500);
}
