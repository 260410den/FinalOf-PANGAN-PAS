# Backend lama PHP + MySQL

Deployment PANGAN PAS di Vercel menggunakan Supabase untuk akun, favorit, pantauan harga, komunitas, dan foto. Backend PHP di folder ini tidak dipanggil oleh aplikasi Vercel; file PHP dan dump MySQL dipertahankan sebagai referensi untuk data lama.

## Menyiapkan backend saat ini

Ikuti panduan [Deploy akun dan komunitas ke Vercel dengan Supabase](../README.md#deploy-akun-dan-komunitas-ke-vercel-dengan-supabase) dan jalankan skema [`../supabase/schema.sql`](../supabase/schema.sql) di Supabase SQL Editor.

## Data MySQL lama

Data dalam database MySQL tidak otomatis disalin ke Supabase. Sebelum menghentikan hosting PHP/MySQL lama, ekspor data yang ingin dipertahankan dan migrasikan ke tabel PostgreSQL Supabase. Password akun lama memakai hash PHP dan perlu penanganan migrasi tersendiri; jangan menyalin hash itu ke kolom Auth Supabase secara langsung.
