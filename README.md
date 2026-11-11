# PANGAN PAS

**Pantau harga pangan dan perubahannya di berbagai wilayah Indonesia.** PANGAN PAS menyajikan informasi dari PIHPS Nasional Bank Indonesia dalam bentuk peta, grafik tren, pencarian wilayah sekitar, dan asisten tanya jawab.

## Fitur

- **Peta harga** — bandingkan harga komoditas antarwilayah.
- **Tren harga** — lihat perubahan harga dalam beberapa periode.
- **Cari di sekitar** — temukan informasi harga di wilayah terdekat yang dipantau.
- **Favorit dan pantauan** — simpan wilayah pilihan dan ikuti perubahan harga.
- **Komunitas** — berbagi temuan harga pangan.
- **Asisten PANGAN PAS** — tanyakan informasi seputar harga pangan.

## Unduh dan jalankan di Windows

1. Buka halaman repo PANGAN PAS di GitHub.
2. Klik **Code → Download ZIP**.
3. Setelah ZIP selesai diunduh, klik kanan file ZIP lalu pilih **Extract All**. Hasil ekstraksi biasanya bernama `FinalOf-PANGAN-PAS-main` di folder Downloads.
4. Pasang [Node.js versi LTS](https://nodejs.org/) jika belum ada. npm akan ikut terpasang.
5. Buka PowerShell, lalu jalankan perintah berikut. Jika nama folder hasil ekstrak berbeda, sesuaikan nama folder pada perintah `cd`.

```powershell
cd "$env:USERPROFILE\Downloads\FinalOf-PANGAN-PAS-main"
npm ci
Copy-Item .env.example .env.local
npm run dev
```

6. Buka alamat yang ditampilkan PowerShell, biasanya `http://127.0.0.1:5173/`.
7. Untuk menghentikan aplikasi, kembali ke PowerShell lalu tekan **Ctrl+C**.

Peta dan tren mengambil data saat terhubung ke internet. Fitur akun, komunitas online, dan layanan AI mungkin belum aktif pada salinan ZIP jika layanan servernya belum disiapkan.

## Deploy akun dan komunitas ke Vercel dengan Supabase

1. Buat project di Supabase, lalu jalankan [`supabase/schema.sql`](supabase/schema.sql) melalui **SQL Editor**.
2. Salin URL project, publishable key, dan secret key dari **Project Settings → API Keys**.
3. Tambahkan `SUPABASE_URL`, `SUPABASE_ANON_KEY` (isi dengan publishable key), dan `SUPABASE_SERVICE_ROLE_KEY` (isi dengan secret key) ke Vercel → **Settings → Environment Variables**. Secret key hanya dipakai di fungsi server dan jangan pernah diberi awalan `VITE_`.
4. Atur URL situs Supabase ke domain production Vercel agar tautan konfirmasi email kembali ke aplikasi. Dengan konfirmasi email aktif, pengguna perlu membuka tautan yang dikirim Supabase sebelum masuk. Jika konfirmasi email dimatikan, pendaftaran langsung masuk.
5. Set `VITE_COMMUNITY_API_URL=server`, lalu deploy ulang. Untuk lokal, isi variabel yang sama di `.env.local` dan restart `npm run dev`.

API akun, favorit, pantauan harga, komunitas, dan foto komunitas berjalan lewat Vercel Functions. Foto disimpan di bucket Supabase Storage `community` yang dibuat oleh SQL tersebut. Data akun lama di MySQL tidak otomatis dipindahkan; ekspor/impor data perlu dilakukan sebelum mematikan backend lama.

## Cara menggunakan

### Bandingkan harga di peta
Buka **Peta harga**, lalu pilih komoditas, wilayah, periode, dan jenis tempat belanja. Warna pada peta menunjukkan arah perubahan harga: hijau berarti turun, kuning stabil, merah naik, dan abu-abu berarti data belum tersedia.

### Lihat perubahan harga
Buka **Tren** untuk memilih komoditas dan rentang waktu. Gunakan grafik untuk melihat perubahan harga; data yang tersedia juga bisa diunduh sebagai CSV.

### Cari informasi di sekitar
Buka **Sekitar** untuk mencari harga di kota atau kabupaten yang dipantau. Kamu bisa memilih wilayah secara manual atau menggunakan lokasi perangkat. Izin lokasi diperlukan hanya jika kamu memilih pencarian berdasarkan lokasimu.

### Simpan wilayah dan pantauan
Masuk ke akun untuk menyimpan provinsi favorit dan mengatur pantauan harga. Jika tersedia, notifikasi akan muncul saat data baru memenuhi aturan pantauanmu.

### Berbagi temuan di Komunitas
Masuk ke akun untuk mengirim temuan harga, foto bukti, komentar, atau balasan. Kiriman baru berstatus **belum diverifikasi** sampai diperiksa.

### Tanyakan sesuatu ke Asisten
Gunakan **Tanya AI** untuk bertanya tentang harga yang sedang ditampilkan. Contoh:

- “Di provinsi mana harga cabai merah paling rendah?”
- “Bagaimana perubahan harga beras dalam 30 hari terakhir?”
- “Apa perbedaan harga pasar tradisional dan supermarket?”

Jawaban mengikuti data yang tersedia untuk wilayah, komoditas, dan periode tersebut. Jika datanya tidak tersedia, aplikasi tidak mengisinya dengan perkiraan.

## Memahami data harga

Harga bersumber dari [PIHPS Nasional Bank Indonesia](https://www.bi.go.id/hargapangan). Nilai yang ditampilkan merupakan **rata-rata pasar yang dipantau PIHPS**, bukan harga dari setiap toko. Ketersediaan data dapat berbeda menurut komoditas, wilayah, periode, dan jenis tempat belanja. Label **Data belum tersedia** berarti tidak ada angka yang ditampilkan untuk pilihan tersebut.
