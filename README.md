# RSCPL To-Do — Manajemen Tugas Rumah Sakit

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
- [Prisma](https://www.prisma.io/) + **SQLite** — database
- `jose` (JWT) + `bcryptjs` — autentikasi
- CSS murni (tanpa framework)

## Menjalankan secara lokal

Prasyarat: **Node.js 18+**.

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan environment
cp .env.example .env
# lalu buka .env dan isi JWT_SECRET dengan nilai acak yang panjang, mis.:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Inisialisasi database + data contoh (buat tabel & seed)
npm run setup

# 4. Jalankan
npm run dev
# buka http://localhost:3000
```

> `npm run setup` menjalankan `prisma generate`, `prisma db push`, dan seed.
> Untuk mereset database: `npm run db:reset`.

## Akun demo (hasil seed)

| Peran    | Username       | Password       |
| -------- | -------------- | -------------- |
| Admin    | `admin`        | `admin123`     |
| Dokter   | `dr.andi`      | `password123`  |
| Perawat  | `ns.budi`      | `password123`  |
| Apoteker | `siti.farmasi` | `password123`  |

> **Penting:** ganti password default & `JWT_SECRET` sebelum dipakai sungguhan.

## Struktur proyek

```
prisma/
  schema.prisma        # model User & Task
  seed.js              # data awal (admin + personel + contoh tugas)
src/
  middleware.js        # proteksi route (redirect ke /login bila belum masuk)
  lib/
    auth.js            # hash password, JWT, sesi cookie
    prisma.js          # singleton Prisma Client
    constants.js       # konstanta & label (status, peran, prioritas)
    tasks.js           # sinkronisasi status<->progress & progress dari checklist
    activity.js        # pencatat audit log
    format.js          # helper format (tanggal, waktu relatif, inisial)
  app/
    login/             # halaman login
    dashboard/         # papan tugas utama
    admin/             # kelola personel (khusus admin)
    laporan/           # statistik & audit log
    api/
      auth/            # login, logout, me
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
