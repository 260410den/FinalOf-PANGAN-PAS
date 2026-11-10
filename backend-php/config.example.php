<?php
// Salin file ini menjadi config.php lalu isi sesuai hosting Anda. Jangan commit config.php.
return [
    'db_host' => 'localhost',
    'db_name' => 'pangan_pas',
    'db_user' => 'root',
    'db_pass' => 'root',
    // Domain frontend yang boleh memanggil API (CORS). Contoh: https://pangan-pas.vercel.app
    'allowed_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],
    // Folder penyimpanan foto (harus bisa ditulis oleh PHP) dan URL publiknya.
    'upload_dir' => __DIR__ . '/uploads',
    'upload_url' => 'http://localhost/pangan-pas-backend/uploads',
    'max_photo_bytes' => 2 * 1024 * 1024,

    /* ---------- Akun ---------- */
    // Rahasia bersama dengan proxy frontend (env ACCOUNT_PROXY_SECRET di Vercel/.env.local).
    // Bila diisi, API akun hanya menerima permintaan lewat proxy /api/akun. Buat acak, mis. `openssl rand -hex 32`.
    'proxy_secret' => '',
    // Cookie sesi: HttpOnly selalu aktif. Set cookie_secure=false hanya untuk uji lokal lewat http://localhost.
    'cookie_secure' => true,
    'cookie_samesite' => 'Lax',
    'session_days' => 14,

];
