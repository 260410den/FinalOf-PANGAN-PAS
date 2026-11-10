-- Migrasi komunitas → wajib login (menambah kolom pengguna_id).
-- AMAN dijalankan berkali-kali: perubahan hanya dijalankan bila kolom/indeksnya belum ada (tidak ada galat #1060).
-- Semua tabel ditulis lengkap "pangan_pas.nama_tabel", jadi tetap benar walau phpMyAdmin memindah
-- database aktif ke information_schema (penyebab galat #1044). Instalasi baru dari pangan_pas_komunitas.sql
-- sudah punya kolom ini; menjalankan file ini tetap tidak masalah.
-- Jika nama database Anda bukan pangan_pas, ganti semua "pangan_pas" di file ini.

-- kiriman_harga.pengguna_id
SET @ada := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = 'pangan_pas' AND TABLE_NAME = 'kiriman_harga' AND COLUMN_NAME = 'pengguna_id');
SET @sql := IF(@ada = 0,
  'ALTER TABLE pangan_pas.kiriman_harga ADD COLUMN pengguna_id INT UNSIGNED NULL COMMENT ''Akun pengirim (tabel pengguna)'' AFTER id',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- indeks kiriman_harga(pengguna_id)
SET @ada := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = 'pangan_pas' AND TABLE_NAME = 'kiriman_harga' AND INDEX_NAME = 'idx_kiriman_pengguna');
SET @sql := IF(@ada = 0, 'ALTER TABLE pangan_pas.kiriman_harga ADD KEY idx_kiriman_pengguna (pengguna_id)', 'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- komentar.pengguna_id
SET @ada := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = 'pangan_pas' AND TABLE_NAME = 'komentar' AND COLUMN_NAME = 'pengguna_id');
SET @sql := IF(@ada = 0, 'ALTER TABLE pangan_pas.komentar ADD COLUMN pengguna_id INT UNSIGNED NULL AFTER kiriman_id', 'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- balasan.pengguna_id
SET @ada := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = 'pangan_pas' AND TABLE_NAME = 'balasan' AND COLUMN_NAME = 'pengguna_id');
SET @sql := IF(@ada = 0, 'ALTER TABLE pangan_pas.balasan ADD COLUMN pengguna_id INT UNSIGNED NULL AFTER komentar_id', 'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Cek hasil: harus muncul 3 baris (kiriman_harga, komentar, balasan).
SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'pangan_pas' AND COLUMN_NAME = 'pengguna_id' AND TABLE_NAME IN ('kiriman_harga', 'komentar', 'balasan');
