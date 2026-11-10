<?php
declare(strict_types=1);
require __DIR__ . '/../account_lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? 'me');
account_boot($method === 'POST');

try {
    if ($method === 'GET' && $action === 'me') {
        $u = current_user();
        json_out(['ok' => true, 'user' => $u ? user_public($u) : null]);
    }
    if ($method !== 'POST') json_out(['ok' => false, 'error' => 'Metode tidak didukung.'], 405);

    if ($action === 'register') {
        if (too_many_attempts()) json_out(['ok' => false, 'error' => 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'], 429);
        $in = read_json();
        $nama = clean_name($in['nama'] ?? '');
        $username = clean_username($in['username'] ?? '');
        $email = clean_email($in['email'] ?? '');
        $password = check_password($in['password'] ?? '', $in['konfirmasi'] ?? '');
        record_attempt();
        if (username_taken($username)) json_out(['ok' => false, 'error' => 'Username sudah dipakai.', 'field' => 'username'], 409);
        $st = db()->prepare('SELECT 1 FROM pengguna WHERE email = ?');
        $st->execute([$email]);
        if ($st->fetchColumn()) json_out(['ok' => false, 'error' => 'Email sudah terdaftar. Silakan masuk.', 'field' => 'email'], 409);
        db()->prepare('INSERT INTO pengguna (nama, username, email, password_hash) VALUES (?, ?, ?, ?)')
            ->execute([$nama, $username, $email, password_hash($password, PASSWORD_DEFAULT)]);
        $id = (int)db()->lastInsertId();
        login_user($id);
        $u = current_user();
        json_out(['ok' => true, 'user' => user_public($u)], 201);
    }

    if ($action === 'login') {
        if (too_many_attempts()) json_out(['ok' => false, 'error' => 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'], 429);
        $in = read_json();
        $id = strtolower(trim((string)($in['identitas'] ?? '')));
        $password = (string)($in['password'] ?? '');
        if ($id === '' || $password === '') json_out(['ok' => false, 'error' => 'Isi username/email dan password.'], 422);
        $st = db()->prepare('SELECT * FROM pengguna WHERE username = ? OR email = ? LIMIT 1');
        $st->execute([$id, $id]);
        $u = $st->fetch();
        // Same message and a hash check either way, so the response doesn't reveal which accounts exist.
        $hash = $u['password_hash'] ?? '';
        $valid = $hash !== '' && password_verify($password, $hash);
        if (!$u || !$valid) {
            if (!$u || $hash === '') password_hash($password, PASSWORD_DEFAULT); // keep timing similar
            record_attempt();
            json_out(['ok' => false, 'error' => 'Username/email atau password salah.'], 401);
        }
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE pengguna SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), (int)$u['id']]);
        }
        clear_attempts();
        login_user((int)$u['id']);
        json_out(['ok' => true, 'user' => user_public(current_user())]);
    }

    if ($action === 'logout') {
        logout_user();
        json_out(['ok' => true]);
    }

    json_out(['ok' => false, 'error' => 'Aksi tidak dikenal.'], 400);
} catch (PDOException $e) {
    error_log('[pangan-pas auth] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'Server database sedang bermasalah.'], 500);
}
