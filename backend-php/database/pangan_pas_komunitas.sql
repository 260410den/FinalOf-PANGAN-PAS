-- PANGAN PAS — database komunitas (MySQL 5.7+/MariaDB 10.3+)
-- Impor lewat phpMyAdmin: pilih database (atau buat baru), tab "Import", pilih file ini, klik "Go".

CREATE DATABASE IF NOT EXISTS pangan_pas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pangan_pas;

CREATE TABLE IF NOT EXISTS kiriman_harga (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pengguna_id        INT UNSIGNED NULL COMMENT 'Akun pengirim (tabel pengguna)',
  nama_kontributor   VARCHAR(48)  NOT NULL,
  komoditas          VARCHAR(60)  NOT NULL,
  harga              INT UNSIGNED NOT NULL COMMENT 'Rupiah per satuan',
  satuan             VARCHAR(16)  NOT NULL,
  jenis_tempat       ENUM('Pasar tradisional','Supermarket') NOT NULL,
  nama_pasar_toko    VARCHAR(80)  NOT NULL,
  provinsi           VARCHAR(60)  NOT NULL,
  tanggal_pengamatan DATE         NOT NULL,
  catatan            VARCHAR(240) NULL,
  foto_path          VARCHAR(255) NULL COMMENT 'Path relatif file foto di folder uploads/',
  status_verifikasi  ENUM('belum_diverifikasi','terverifikasi','ditolak') NOT NULL DEFAULT 'belum_diverifikasi',
  delete_token_hash  CHAR(64)     NOT NULL COMMENT 'SHA-256 token hapus milik pengirim',
  waktu_kirim        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kiriman_waktu (waktu_kirim),
  KEY idx_kiriman_pengguna (pengguna_id),
  KEY idx_kiriman_komoditas_provinsi (komoditas, provinsi),
  KEY idx_kiriman_status (status_verifikasi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS komentar (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kiriman_id  INT UNSIGNED NOT NULL,
  pengguna_id INT UNSIGNED NULL,
  nama        VARCHAR(48)  NOT NULL DEFAULT 'Pengunjung',
  isi         VARCHAR(240) NOT NULL,
  waktu_kirim DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_komentar_kiriman (kiriman_id, waktu_kirim),
  CONSTRAINT fk_komentar_kiriman FOREIGN KEY (kiriman_id) REFERENCES kiriman_harga (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS balasan (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  komentar_id INT UNSIGNED NOT NULL,
  pengguna_id INT UNSIGNED NULL,
  nama        VARCHAR(48)  NOT NULL DEFAULT 'Pengunjung',
  isi         VARCHAR(240) NOT NULL,
  waktu_kirim DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_balasan_komentar (komentar_id, waktu_kirim),
  CONSTRAINT fk_balasan_komentar FOREIGN KEY (komentar_id) REFERENCES komentar (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
