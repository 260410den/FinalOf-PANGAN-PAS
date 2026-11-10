-- PANGAN PAS — database akun pengguna (MySQL 5.7+/MariaDB 10.3+)
-- Impor lewat phpMyAdmin: tab "Import", pilih file ini, klik "Go".
-- Aman diimpor ke database yang sama dengan pangan_pas_komunitas.sql.

CREATE DATABASE IF NOT EXISTS pangan_pas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pangan_pas;

-- Akun. Password hanya disimpan sebagai hash bcrypt/argon (password_hash PHP), tidak pernah teks asli.
CREATE TABLE IF NOT EXISTS pengguna (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama             VARCHAR(80)  NOT NULL,
  username         VARCHAR(30)  NOT NULL,
  email            VARCHAR(190) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL COMMENT 'Hash password_hash() PHP (bcrypt/argon)',
  tema             ENUM('terang','gelap') NOT NULL DEFAULT 'terang',
  notifikasi_harga TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Opt-in, default mati',
  akses_lokasi     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Izin memakai lokasi hanya saat diminta, default mati',
  dibuat           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diperbarui       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  login_terakhir   DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pengguna_username (username),
  UNIQUE KEY uq_pengguna_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Provinsi favorit per akun.
CREATE TABLE IF NOT EXISTS lokasi_favorit (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pengguna_id INT UNSIGNED NOT NULL,
  provinsi    VARCHAR(60)  NOT NULL,
  dibuat      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_favorit (pengguna_id, provinsi),
  CONSTRAINT fk_favorit_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pantauan harga (notifikasi). Dievaluasi saat pengguna membuka aplikasi, paling sering sekali per 12 jam per pantauan.
CREATE TABLE IF NOT EXISTS pantauan_harga (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pengguna_id         INT UNSIGNED NOT NULL,
  komoditas           VARCHAR(60)  NOT NULL,
  wilayah             VARCHAR(60)  NOT NULL COMMENT 'Nama provinsi PIHPS atau Indonesia (rata-rata nasional)',
  jenis_pasar         ENUM('tradisional','modern') NOT NULL DEFAULT 'tradisional',
  arah                ENUM('naik','turun','keduanya') NOT NULL DEFAULT 'keduanya',
  tipe_batas          ENUM('persen','nominal') NOT NULL DEFAULT 'persen',
  nilai_batas         DECIMAL(12,2) NOT NULL COMMENT 'Persen (mis. 5.00) atau rupiah (mis. 1000)',
  periode             ENUM('7 hari','14 hari','30 hari') NOT NULL DEFAULT '7 hari' COMMENT 'Periode pembanding',
  aktif               TINYINT(1)   NOT NULL DEFAULT 1,
  terakhir_dicek      DATETIME     NULL,
  terakhir_dikirim    DATETIME     NULL,
  tanggal_data_terkirim DATE       NULL COMMENT 'Tanggal data PIHPS pada peringatan terakhir (cegah peringatan ganda)',
  dibuat              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pantauan_pengguna (pengguna_id, aktif),
  CONSTRAINT fk_pantauan_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Riwayat peringatan yang sudah dikirim ke pengguna (kotak notifikasi di aplikasi).
CREATE TABLE IF NOT EXISTS notifikasi_harga (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pengguna_id   INT UNSIGNED NOT NULL,
  pantauan_id   INT UNSIGNED NULL,
  komoditas     VARCHAR(60)  NOT NULL,
  wilayah       VARCHAR(60)  NOT NULL,
  jenis_pasar   ENUM('tradisional','modern') NOT NULL,
  harga_awal    INT UNSIGNED NOT NULL,
  harga_akhir   INT UNSIGNED NOT NULL,
  persen        DECIMAL(7,2) NOT NULL,
  periode       VARCHAR(16)  NOT NULL,
  tanggal_awal  DATE         NOT NULL,
  tanggal_akhir DATE         NOT NULL,
  sumber        VARCHAR(80)  NOT NULL DEFAULT 'PIHPS Nasional – Bank Indonesia',
  dibaca        TINYINT(1)   NOT NULL DEFAULT 0,
  dibuat        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_pengguna (pengguna_id, dibuat),
  CONSTRAINT fk_notif_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_pantauan FOREIGN KEY (pantauan_id) REFERENCES pantauan_harga (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pembatas percobaan login (anti tebak password).
CREATE TABLE IF NOT EXISTS percobaan_login (
  id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip     VARCHAR(45)  NOT NULL,
  waktu  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_percobaan_ip_waktu (ip, waktu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
