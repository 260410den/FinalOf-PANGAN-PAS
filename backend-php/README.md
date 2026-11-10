# Backend komunitas PANGAN PAS (PHP + MySQL)

Menyimpan kiriman harga, komentar, dan balasan ke MySQL. Foto bukti disimpan di folder `uploads/`
dan path-nya dicatat di kolom `kiriman_harga.foto_path`. Semua kiriman berstatus `belum_diverifikasi`
sampai diubah oleh admin (mis. lewat phpMyAdmin: ubah kolom `status_verifikasi` menjadi `terverifikasi`
atau `ditolak`; kiriman `ditolak` tidak ditampilkan).

## Pasang
1. Buat database lewat phpMyAdmin → tab **Import** → pilih `database/pangan_pas_komunitas.sql` → **Go**.
2. Unggah isi folder `backend-php/` ke hosting PHP 7.4+ (ekstensi `pdo_mysql` dan `mbstring` diperlukan; `gd` tidak wajib).
3. Salin `config.example.php` menjadi `config.php`, isi kredensial database, `allowed_origins`
   (domain frontend, mis. `https://pangan-pas.vercel.app`), `upload_dir`, dan `upload_url`.
4. Pastikan folder `uploads/` bisa ditulis PHP. File `uploads/.htaccess` melarang akses eksekusi skrip pada hosting Apache.
5. Untuk akun dan komunitas server, isi variabel frontend `ACCOUNT_API_ORIGIN=https://domain-anda/pangan-pas-backend/api`
   dan `ACCOUNT_PROXY_SECRET` dengan nilai yang sama seperti `proxy_secret` di `config.php`.
   Untuk mengaktifkan penyimpanan komunitas server, set `VITE_COMMUNITY_API_URL=server` (nilai penanda, bukan URL).
   Atur variabel di Vercel → Environment Variables atau `.env.local`, lalu build/deploy ulang.
   Tanpa variabel ini, halaman Komunitas tetap jalan dalam **mode lokal** (tersimpan di browser).

## Endpoint
| Method | URL | Isi |
| --- | --- | --- |
| GET | `api/kiriman.php?limit=50` | Daftar kiriman + komentar + balasan (boleh tanpa login) |
| POST | `api/kiriman.php` | **Wajib login.** JSON `{commodity, price, unit, seller, marketName, region, date, notes, proof}`; nama diambil dari akun; `proof` = data URL JPG/PNG/WebP (≤2 MB). |
| DELETE | `api/kiriman.php?id=..` | **Wajib login.** Hanya pemilik kiriman |
| POST | `api/komentar.php` | **Wajib login.** `{kiriman_id, text}` menambah komentar (nama dari akun) |
| POST | `api/komentar.php` | **Wajib login.** `{komentar_id, text, reply: true}` menambah balasan |

Catatan keamanan: belum ada rate limit atau captcha; pertimbangkan menambahkannya sebelum dibuka untuk umum.

---

# Akun pengguna (Daftar, Masuk, Profil, Pantauan harga)

## Pasang
1. phpMyAdmin → **Import** → `database/pangan_pas_akun.sql` → **Go** (boleh di database yang sama dengan komunitas).
   Tabel: `pengguna`, `lokasi_favorit`, `pantauan_harga`, `notifikasi_harga`, `percobaan_login`.
2. Di `config.php` (salin dari `config.example.php`) isi bagian **Akun**:
   - `proxy_secret`: string acak panjang; isi nilai yang sama di env frontend `ACCOUNT_PROXY_SECRET`.
   - `cookie_secure`: `true` di produksi (HTTPS). Untuk uji lokal lewat `http://localhost` boleh `false`.
3. Di frontend (Vercel env atau `.env.local`): `ACCOUNT_API_ORIGIN=https://domain-php-anda/pangan-pas-backend/api`
   dan `ACCOUNT_PROXY_SECRET` dengan nilai yang sama. Build/deploy ulang.

Frontend memanggil `/api/akun/<endpoint>` di domainnya sendiri; fungsi `api/akun.js` meneruskan ke PHP.
Karena itu cookie sesi menjadi cookie domain situs (first-party), tetap jalan walau browser memblokir cookie pihak ketiga.

## Keamanan
- Password disimpan dengan `password_hash()` (bcrypt/argon). Tidak ada password atau token yang dikirim ke browser.
- Login memakai sesi PHP; browser hanya menyimpan cookie `PPSESS` yang **HttpOnly** (tidak bisa dibaca JavaScript),
  `SameSite=Lax`, dan `Secure` di produksi. Frontend tidak menyimpan apa pun di localStorage/sessionStorage untuk login.
- Semua permintaan yang mengubah data wajib membawa header `X-Pangan-Request: 1` (perlindungan CSRF).
- Maksimal 10 percobaan login/daftar gagal per IP per 15 menit. ID sesi diganti setiap login.

## Masuk
Login dengan **username atau email + password** (tanpa OTP). Avatar memakai inisial nama.

## Endpoint (lewat proxy `/api/akun/...`)
| Method | URL | Isi |
| --- | --- | --- |
| GET | `auth?action=me` | Akun yang sedang masuk atau `null` |
| POST | `auth?action=register` | `{nama, username, email, password, konfirmasi}` → langsung masuk |
| POST | `auth?action=login` | `{identitas, password}` (username atau email) |
| POST | `auth?action=logout` | Keluar |
| POST | `profil?action=update` | `{nama, username}` |
| POST | `profil?action=password` | `{lama?, baru, konfirmasi}` |
| POST | `profil?action=prefs` | `{tema, notifikasiHarga, aksesLokasi}` |
| POST | `profil?action=favorit-tambah` / `favorit-hapus` / `favorit-gabung` | `{provinsi}` / `{daftar}` |
| GET | `pantauan` | Daftar pantauan + kotak notifikasi |
| POST | `pantauan?action=buat` / `ubah` / `hapus` / `lapor` / `baca` | Kelola pantauan & notifikasi |

## Notifikasi harga & lokasi
- Notifikasi **opsional** (default mati). Pantauan dicek saat pengguna membuka aplikasi, paling sering **sekali per 12 jam**
  per pantauan; satu tanggal data hanya memicu satu peringatan. Tidak ada peringatan bila data PIHPS lebih dari 5 hari
  atau belum cukup untuk dibandingkan. Belum ada push saat aplikasi tertutup (butuh service worker + server push).
- Akses lokasi (default mati) hanya dipakai sekali saat pengguna menekan “Cari di sekitar saya”; koordinat tidak dikirim
  ke backend akun dan tidak disimpan.

## Komunitas wajib login
- Frontend memanggil komunitas lewat proxy `/api/akun/kiriman` dan `/api/akun/komentar`, jadi sesi akun ikut terkirim.
  Kirim, komentar, balas, dan hapus ditolak server (401) tanpa login. Aktifkan dengan mengisi `VITE_COMMUNITY_API_URL`
  dengan nilai penanda (mis. `server`) di env frontend; tanpa itu komunitas memakai mode lokal browser. URL PHP yang sebenarnya
  diatur melalui `ACCOUNT_API_ORIGIN`, sedangkan komunitas server memakai proxy akun `/api/akun`.
- Instalasi lama (tabel komunitas dibuat sebelum ada kolom `pengguna_id`): impor `database/migrasi_komunitas_login.sql`.
  File ini aman dijalankan berkali-kali (melewati kolom/indeks yang sudah ada). Instalasi baru tidak membutuhkannya.
