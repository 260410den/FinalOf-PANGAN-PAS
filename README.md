# PANGAN PAS

PANGAN PAS adalah dashboard untuk melihat harga dan perubahan harga pangan antarwilayah di Indonesia. Data harga berasal dari PIHPS Nasional Bank Indonesia dan disajikan sebagai rata-rata wilayah pantauan, bukan harga dari setiap toko.

## Jalankan di komputer sendiri

Pastikan Git, Node.js versi LTS, dan npm tersedia. Buka terminal di folder hasil clone—folder yang langsung berisi `package.json`—lalu jalankan:

```powershell
git clone https://github.com/AKUN-ANDA/NAMA-REPO.git
cd NAMA-REPO
npm ci
Copy-Item .env.example .env.local
npm run dev
```

> `cd` cukup sekali: setelah masuk ke folder repo, `package.json` sudah berada di folder itu. Vite menampilkan alamat lokal seperti `http://127.0.0.1:5173/`.

`.env.local` boleh dibiarkan seperti contoh untuk mencoba tampilan dan fitur yang tidak memerlukan layanan eksternal. Setelah mengubah variabel lingkungan, hentikan lalu jalankan kembali `npm run dev`.

### Pengaturan layanan

Salin `.env.example` menjadi `.env.local`, lalu isi hanya layanan yang akan dipakai:

| Variabel | Kegunaan |
| --- | --- |
| `NVIDIA_API_KEY` | Kunci server untuk jawaban AI, analisis gambar, dan bantuan AI di Tren/Komunitas. Tanpa kunci ini, fitur AI yang memanggil model tidak aktif. Jangan pernah menaruh kunci ini di kode frontend. |
| `NVIDIA_MODEL` | Model NVIDIA yang dipakai. Jika dikosongkan, aplikasi memakai model bawaan di `api/ai.js`. |
| `NVIDIA_BASE_URL` | Alamat API NVIDIA yang dipakai. Opsional; default-nya API NVIDIA NIM. |
| `ACCOUNT_API_ORIGIN` | Alamat folder `api` pada backend PHP yang sudah di-host, misalnya `https://domain-php-anda/pangan-pas-backend/api`. Dibutuhkan untuk daftar, masuk, profil, pantauan harga, dan komunitas server. |
| `ACCOUNT_PROXY_SECRET` | Rahasia acak yang sama dengan `proxy_secret` pada `backend-php/config.php`. Dibutuhkan bila proxy akun dikunci dengan rahasia bersama. |
| `VITE_COMMUNITY_API_URL` | Sakelar mode komunitas. Kosong berarti penyimpanan lokal di browser. Isi `server` setelah backend PHP/MySQL tersedia agar kiriman dan komentar memakai database lewat proxy akun. **Jangan isi URL PHP di variabel ini.** |

Variabel `ACCOUNT_API_ORIGIN` dan `ACCOUNT_PROXY_SECRET` hanya dipakai server. `VITE_COMMUNITY_API_URL` adalah penanda mode yang ikut ke build frontend, bukan tempat menyimpan kunci atau URL privat.

### Backend PHP dan MySQL

Backend PHP di-host terpisah dari frontend Vercel. Siapkan hosting PHP dan MySQL, impor skema database, lalu konfigurasi `backend-php/config.php`. Panduan instalasi, endpoint, dan tabel ada di [`backend-php/README.md`](backend-php/README.md).

Urutan umumnya:

1. Host folder `backend-php/` pada penyedia hosting PHP.
2. Buat database dan impor file SQL sesuai fitur yang akan dipakai.
3. Salin `backend-php/config.example.php` menjadi `config.php`; isi database, URL foto, domain frontend, dan rahasia proxy akun.
4. Isi `ACCOUNT_API_ORIGIN` serta `ACCOUNT_PROXY_SECRET` pada pengaturan lokal atau Vercel.
5. Isi `VITE_COMMUNITY_API_URL=server` jika komunitas akan memakai database.
6. Jalankan ulang server lokal atau build/deploy ulang agar variabel baru terbaca.

Tanpa backend akun, daftar dan masuk belum berfungsi. Tanpa backend komunitas, mode komunitas lokal hanya menyimpan data di browser yang sedang dipakai.

## Build

```bash
npm run build
```

Hasil build frontend tersimpan di `dist/`. API Node untuk harga, AI, wilayah, dan proxy akun berada di `api/` dan dikonfigurasi sebagai Vercel Functions.

## Deploy frontend ke Vercel

1. Push repo ini ke GitHub, lalu pilih **Add New → Project** di Vercel dan impor repository tersebut.
2. Gunakan root directory `./`, build command `npm run build`, dan output directory `dist`.
3. Tambahkan environment variables yang dibutuhkan di **Project Settings → Environment Variables**. Atur setidaknya `NVIDIA_API_KEY` untuk AI dan `ACCOUNT_API_ORIGIN` plus `ACCOUNT_PROXY_SECRET` bila backend akun sudah siap.
4. Isi `VITE_COMMUNITY_API_URL` dengan `server` hanya jika komunitas server sudah siap.
5. Deploy ulang setelah menyimpan atau mengubah variabel.
6. Jika domain frontend berubah, perbarui `allowed_origins` pada konfigurasi PHP dan URL frontend pada `upload_url` sesuai panduan backend.

Backend PHP/MySQL harus tetap tersedia di hosting PHP sendiri. Vercel menangani frontend Vite dan fungsi server JavaScript di `api/`.

## Data dan fitur

- Peta, tren harga, dan halaman sekitar menggunakan endpoint server di `api/` yang mengambil data PIHPS. PIHPS menyajikan rata-rata pasar pantauan, bukan daftar harga setiap toko.
- Asisten dapat menjawab dengan konteks dari data harga yang tersedia. Pemanggilan model dan pembacaan foto memerlukan `NVIDIA_API_KEY` di server.
- Akun, favorit, pantauan, dan komunitas tersimpan di backend PHP/MySQL setelah backend dikonfigurasi.
- Batas akses tamu disimpan di browser dan ditujukan untuk alur penggunaan aplikasi.

## Struktur repository

```text
.
├── api/                  # Fungsi server untuk data, AI, dan proxy akun
├── backend-php/          # API PHP, skema database, dan petunjuk instalasi
├── public/               # Aset statis dan data peta
├── scripts/              # Utilitas untuk menyiapkan data wilayah
├── src/                  # Aplikasi React, halaman, dan komponen
├── index.html            # Dokumen utama Vite
├── package.json          # Perintah dan dependensi proyek
├── vercel.json           # Build, routing SPA, dan konfigurasi fungsi Vercel
└── vite.config.mjs       # Konfigurasi Vite dan API lokal
```

## Unggah ke GitHub pertama kali

Repo lokal ini menggunakan branch `main`. Di GitHub, buat **repository kosong** tanpa README, `.gitignore`, atau license tambahan. Salin URL repository, lalu dari folder proyek ini jalankan:

```bash
git add .
git commit -m "Siapkan repo PANGAN PAS"
git remote add origin https://github.com/AKUN-ANDA/NAMA-REPO.git
git push -u origin main
```

Ganti URL contoh dengan URL repo milikmu. File `.env.local`, konfigurasi PHP privat, folder dependency, dan hasil build tidak ikut terunggah.

## Membuat revisi lewat GitHub

Kerjakan perubahan di branch sendiri agar versi utama tetap rapi:

```bash
git switch -c perbaikan/nama-perubahan
# ubah file yang diperlukan
git add .
git commit -m "Perbaiki nama perubahan"
git push -u origin perbaikan/nama-perubahan
```

Setelah branch muncul di GitHub, buat **Pull Request** ke `main`, tinjau perubahan, lalu gabungkan setelah siap. Jangan menambahkan `.env.local`, `backend-php/config.php`, kata sandi database, atau API key ke commit. `.gitignore` sudah mengecualikan file rahasia dan hasil build.

## Teknologi

- React, React Router, dan Vite
- MapLibre GL JS dan Recharts
- Fungsi server JavaScript pada Vercel
- Backend PHP 7.4+ dan MySQL untuk akun serta komunitas server
- NVIDIA API untuk fitur AI
