# RSP CPL USU — Manajemen Tugas Rumah Sakit

Aplikasi web untuk mengelola **to-do list personel rumah sakit**. Setiap tugas
memiliki **status** (Belum dikerjakan → Sedang dikerjakan → Selesai) dan
**persentase progress (0–100%)** yang dapat diatur user sampai pekerjaan selesai.
Akses dilindungi **login** (autentikasi).

## Fitur

- 🔐 **Login & autentikasi** — password di-hash (bcrypt), sesi disimpan di JWT
  pada cookie httpOnly, seluruh halaman dilindungi middleware.
- 📋 **Papan tugas transparan** — semua personel dapat melihat to-do list semua
  orang, dengan filter per personel, per status, dan pencarian.
- 📊 **Progress ganda** — status bertahap **+** persentase (slider). Status &
  persentase otomatis diselaraskan (100% = Selesai).
- ✍️ **Pembuatan tugas fleksibel** — setiap user dapat membuat tugasnya sendiri,
  dan **admin** dapat menugaskan ke personel mana pun.
- 👥 **Manajemen personel** (khusus admin) — tambah/hapus akun, atur peran &
  departemen.
- 🆕 **Pendaftaran mandiri + verifikasi admin** — siapa pun dapat mendaftar di
  `/daftar` (nama, username, password). Akun baru berstatus **menunggu
  verifikasi** dan **tidak bisa login** sampai **admin menyetujui** di panel
  "Kelola Personel". Admin mendapat notifikasi pendaftar baru & dapat
  memverifikasi/menolak — termasuk lewat **browser HP** (tampilan responsif).
- 🔑 **Akun saya** (`/akun`) — tiap user dapat melihat profilnya & **mengganti
  password sendiri** (wajib verifikasi password lama).
- 🔔 **Notifikasi & pengingat tenggat** — lonceng di top bar dengan badge:
  notifikasi saat tugas **ditugaskan** ke Anda atau ada **komentar baru**, plus
  **pengingat tenggat** otomatis (lewat tempo / hari ini / ≤ 2 hari). Polling
  tiap 60 detik; klik notifikasi membuka detail tugas.
- 🎯 Prioritas (Rendah/Sedang/Tinggi) dan tenggat (due date) dengan penanda lewat tempo.
- ☑️ **Sub-tugas / checklist** — pecah tugas menjadi langkah-langkah; progress &
  status dihitung **otomatis** dari rasio langkah yang selesai.
- 💬 **Komentar & handover** — catatan serah-terima antar personel di tiap tugas
  (cocok untuk pergantian shift).
- 🧾 **Riwayat aktivitas (audit log)** — mencatat otomatis siapa membuat/mengubah/
  menyelesaikan/menghapus apa & kapan (per tugas dan global).
- 📈 **Laporan & statistik** (`/laporan`) — ringkasan status, tugas lewat tenggat,
  tingkat penyelesaian, beban kerja per personel & per departemen.

## Teknologi

- [Next.js 15](https://nextjs.org/) (App Router) — frontend + backend (route handlers)
- [Prisma](https://www.prisma.io/) + **PostgreSQL** — database
- `jose` (JWT) + `bcryptjs` — autentikasi
- CSS murni (tanpa framework)

## Menjalankan secara lokal

Prasyarat: **Node.js 18+** dan sebuah **database PostgreSQL**. Cara termudah:
buat database gratis di [Neon](https://neon.tech), salin *connection string*-nya
(tidak perlu memasang PostgreSQL di komputer).

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan environment
cp .env.example .env
# Buka .env, lalu:
#  - isi DATABASE_URL dengan connection string PostgreSQL (mis. dari Neon)
#  - isi JWT_SECRET dengan nilai acak panjang:
#      node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Buat tabel + data contoh (demo)
npm run setup

# 4. Jalankan
npm run dev
# buka http://localhost:3000
```

> `npm run setup` menjalankan `prisma generate`, `prisma db push`, dan seed (data demo).
> Reset database: `npm run db:reset`. Untuk produksi tanpa data demo, lihat
> bagian **Deploy online** di bawah.

## Akun demo (hasil seed)

| Peran    | Username       | Password       |
| -------- | -------------- | -------------- |
| Admin    | `admin`        | `admin123`     |
| Dokter   | `dr.andi`      | `password123`  |
| Perawat  | `ns.budi`      | `password123`  |
| Apoteker | `siti.farmasi` | `password123`  |

> Seed juga membuat satu **pendaftar contoh** (`calon.staf`) berstatus *menunggu
> verifikasi*, agar fitur verifikasi admin langsung terlihat di panel "Kelola Personel".

> **Penting:** ganti password default & `JWT_SECRET` sebelum dipakai sungguhan.

## Deploy online (Vercel + Neon)

Aplikasi ini siap di-deploy **gratis** ke **Vercel** dengan database **PostgreSQL**
dari **Neon**. Hasilnya: URL `https://....vercel.app` yang bisa dibuka dari
**browser HP mana pun**, dengan HTTPS otomatis & data tersimpan permanen.

1. **Buat database (Neon).** Daftar di [neon.tech](https://neon.tech) → buat project →
   salin *connection string* (pilih yang **Pooled**), bentuknya seperti:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

2. **Inisialisasi database + admin pertama** (dari komputer Anda, sekali saja):

   ```bash
   export DATABASE_URL="<connection string Neon>"
   npx prisma db push     # buat semua tabel di database Neon
   npm run db:admin       # buat 1 akun admin (default: admin / admin123)
   ```

   Ingin username/password admin sendiri:
   `ADMIN_USERNAME=...  ADMIN_PASSWORD=...  npm run db:admin`
   (Untuk mengisi data demo, pakai `npm run db:seed` alih-alih `db:admin`.)

3. **Deploy ke Vercel.** Daftar di [vercel.com](https://vercel.com) (login via GitHub) →
   **Add New… → Project** → pilih repo ini → bagian **Environment Variables**, isi:
   - `DATABASE_URL` = connection string Neon (sama seperti di atas)
   - `JWT_SECRET` = string acak panjang (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)

   Klik **Deploy**. Vercel menjalankan `prisma generate` (via `postinstall`) lalu
   `next build` secara otomatis.

4. **Pakai.** Buka URL Vercel di HP → login sebagai admin → **ganti password admin**.
   Personel lain **mendaftar di `/daftar`**, lalu Anda **verifikasi** mereka di
   **Kelola Personel**.

> Deploy dari branch yang berisi kode ini (mis. setelah PR di-*merge* ke `main`).
> Selain Vercel, kode ini juga jalan di Railway/Render/Fly (gunakan PostgreSQL yang sama).

## Struktur proyek

```
prisma/
  schema.prisma        # model User (punya status PENDING/ACTIVE), Task, dll.
  seed.js              # data demo (admin + personel + tugas + pendaftar contoh)
  create-admin.js      # buat 1 akun admin untuk produksi (npm run db:admin)
src/
  middleware.js        # proteksi route ("/" & "/login" publik, sisanya butuh login)
  lib/
    auth.js            # hash password, JWT, sesi cookie
    prisma.js          # singleton Prisma Client
    constants.js       # konstanta & label (status, peran, prioritas)
    tasks.js           # sinkronisasi status<->progress & progress dari checklist
    activity.js        # pencatat audit log
    format.js          # helper format (tanggal, waktu relatif, inisial)
    hospitalProfile.js # KONTEN PROFIL RS (visi/misi/falsafah/milestone) - edit di sini
  app/
    page.js            # halaman awal publik (profil RS)
    login/             # halaman login
    daftar/            # halaman pendaftaran mandiri (publik)
    dashboard/         # papan tugas utama
    admin/             # kelola personel (khusus admin)
    laporan/           # statistik, audit log, ekspor CSV/PDF
    api/
      auth/            # login, logout, me, register (pendaftaran)
      tasks/           # CRUD tugas + /[id]/checklist + /[id]/comments
      users/           # kelola personel
      stats/           # agregasi laporan
      activity/        # riwayat aktivitas global
  components/          # Board, TaskCard, TaskDetailModal, Reports, dll.
```

## Catatan keamanan

- Password tidak pernah disimpan dalam bentuk teks (selalu di-hash bcrypt).
- Cookie sesi `httpOnly` + `sameSite=lax`; aktifkan HTTPS di produksi agar
  flag `secure` berlaku.
- Otorisasi diperiksa di setiap endpoint API (bukan hanya di UI).
