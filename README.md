# Wellfora - Platform Kesejahteraan Mental & Perlindungan Pekerja (UAS)

Wellfora adalah platform aplikasi web terintegrasi yang dirancang untuk mendukung kesehatan psikologis, kepatuhan ketenagakerjaan, dan perlindungan hak-hak pekerja di tempat kerja. Dikembangkan sebagai proyek Ujian Akhir Semester (UAS) menggunakan arsitektur berbasis peran (**Role-Based Access Control / RBAC**) dengan antarmuka modern yang menenangkan (nuansa hijau salvia dan krem).

---

## 🌟 Fitur Utama & Arsitektur Sistem

### 1. Konsep Akses & Navigasi (E-Commerce Style / Guest Mode)
- **Landing Page Publik:** Pengunjung dan calon karyawan dapat leluasa membaca informasi platform, direktori layanan, alur transparansi persetujuan, serta artikel edukasi kesehatan mental tanpa harus login terlebih dahulu.
- **Gated Actions:** Tombol interaktif (seperti *Ajukan Surat Izin*, *Booking Psikolog*, *ATMA*, dan *Buat Pengaduan*) diproteksi. Jika pengguna belum login, sistem secara otomatis memunculkan **Gated Action Modal** atau mengarahkan ke halaman Login dengan parameter `redirect` tujuan.

### 2. Struktur 5 Peran Pengguna (RBAC) & Pemisahan Rute Mandiri
Setiap peran memiliki **URL rute portal mandiri** yang dilindungi secara ketat oleh komponen pengawal akses (`AccessGuard` di frontend dan `allowRoles()` di backend):

1. **Karyawan (`EMPLOYEE`) ➔ Rute: `/dashboard/karyawan`**
   - Check-in mood harian & asesmen DASS-21 terstandar.
   - Formulir pengajuan Surat Izin (Cuti, Sakit dengan lampiran, Dinas) & Live Approval Tracker.
   - Booking konsultasi tele-health bersama psikolog & rekam rekomendasi klinis.
   - ATMA (**Asisten Teman Mental Anda**) 24/7 dengan deteksi risiko otomatis.
   - Pengaduan Kasus Hukum & Whistleblowing (dengan opsi Anonim).
   - Linimasa pelacakan status terpadu (*Unified Status Tracker*).

2. **HRD (`HR_ADMIN`) ➔ Rute: `/dashboard/hrd`**
   - Dashboard verifikasi & approval Surat Izin (*Pending*, *Approved*, *Rejected*).
   - Pengajuan akun karyawan baru dengan data nama, nomor telepon, divisi, dan jabatan untuk ditinjau Superadmin.
   - Setelah disetujui, HRD dapat membagikan tautan aktivasi sekali pakai yang berlaku 24 jam; karyawan membuat password sendiri.
   - Pelacakan status permohonan dan aktivasi akun; HRD tidak dapat melihat atau mengubah password karyawan.
   - Catatan resmi verifikasi HRD pada setiap permohonan.
   - Manajemen penanganan keluhan internal & monitoring absensi kesehatan.
   - Laporan metrik kesejahteraan tim kerja.
   - *(Dilarang diakses oleh Karyawan/Psikolog/Legal — Otomatis diblokir 403 Forbidden).*

3. **Psikolog (`PSYCHOLOGIST`) ➔ Rute: `/dashboard/psikolog`**
   - Manajemen jadwal praktik & slot ketersediaan (tambah & hapus slot hari/jam).
   - Persetujuan janji temu konseling (*Pending* ➔ *Confirmed* ➔ *In Progress* ➔ *Completed*).
   - Pendokumentasian Catatan Sesi Medis/Psikologis (*Clinical Notes*) dan Rencana Pemulihan (*Action Plan*).
   - Penyediaan tautan ruang sesi telekonseling tertutup.

4. **Pengacara / Tim Hukum (`LEGAL_COUNSEL`) ➔ Rute: `/dashboard/legal`**
   - Dashboard khusus laporan pengaduan pelanggaran hukum (pelecehan seksual, kekerasan fisik/intimidasi, pelanggaran upah & lembur paksa, diskriminasi).
   - Penjaminan kerahasiaan identitas pelapor (*Whistleblower Protection*).
   - Manajemen status tahapan perkara (*Submitted* ➔ *In Review* ➔ *Investigation* ➔ *Mediation* ➔ *Resolved/Closed*).
   - Input Telaah Hukum, Catatan Fakta Investigasi, dan Berita Acara Mediasi.

5. **Superadmin (`SUPER_ADMIN`) ➔ Rute: `/dashboard/superadmin`**
   - Kontrol penuh atas seluruh akun pengguna (pencarian, filter peran, filter status).
   - **Deaktivasi Akun Karyawan Resign:** Menolak akses masuk karyawan yang telah dinonaktifkan/resign.
   - Pengubahan peran pengguna (*Role Switcher*) & penambahan akun baru.
   - Monitoring statistik platform & master data sistem.

> 🛡️ **Pemisahan Hak Akses Ketat (Strict Route Guard):**
> Pengguna di dalam portal **tidak dapat** berpindah peran lewat navbar. Bar switch role telah dihilangkan dari dalam dashboard. Jika seorang Karyawan mencoba membuka URL `/dashboard/hrd` atau `/dashboard/superadmin`, sistem langsung menampilkan **Layar Blokir 403 Forbidden Shield** ("Akses Ditolak: Anda login sebagai Karyawan dan tidak memiliki wewenang membuka Portal HRD"). Untuk berpindah peran, pengguna wajib **Logout** dan login kembali dengan akun yang bersangkutan di `/login`.

### 3. ATMA (Asisten Teman Mental Anda) dengan Deteksi Risiko
- **Severe Stress / Burnout Detection:** Menganalisis indikasi kelelahan emosional kronis, depresi, atau krisis. Memberikan respons empati mendalam dan memunculkan kartu rekomendasi 1-klik untuk **Booking Konseling Psikolog**.
- **Legal Violation / Harassment Detection:** Menganalisis indikasi pelecehan seksual, kekerasan, pemaksaan lembur, atau intimidasi. Memberikan panduan keselamatan dan kartu eskalasi 1-klik untuk **Membuat Laporan Pengaduan Hukum**.
- **Percakapan Kontekstual:** Merespons cerita atau pertanyaan dengan refleksi yang mengacu pada pesan karyawan dan mengarahkan percakapan pada langkah berikutnya.

---

## 🔐 Akun dan Login

Login menggunakan nomor telepon dan password. Tidak ada OTP atau verifikasi wajah. Setelah login berhasil, pengguna diarahkan ke portal berdasarkan role yang sudah ditetapkan pada akunnya.

Untuk menguji akun yang sudah dibuat:
- Akun seed memakai nomor `081234567890` (karyawan), `081298765432` (HRD), `081311223344` (psikolog), `081355667788` (legal), atau `081122334455` (superadmin). Password semua akun seed adalah nilai `SEED_DEMO_PASSWORD` yang dipakai saat seeding.
- Tombol **Akses Instan** hanya tersedia di development.
- HRD mengajukan data calon karyawan dan divisinya; permohonan harus disetujui Superadmin sebelum akun dapat digunakan.
- Saat meninjau permohonan, Superadmin memilih role sesuai divisi dan jabatan (Karyawan, HRD, Psikolog, atau Legal). Role Superadmin tidak dapat diberikan melalui permohonan HRD. Setelah disetujui, HRD membagikan tautan aktivasi sekali pakai yang berlaku 24 jam; karyawan menetapkan password minimal 12 karakter sendiri, yang tidak dapat dilihat atau diubah HRD.
- Superadmin tetap dapat membuat akun manual, mengatur nomor telepon/password, serta menentukan role pengguna.

Pendaftaran mandiri dinonaktifkan. Untuk akun karyawan baru, hubungi HRD perusahaan.

---

## 🛠️ Tech Stack & Keamanan

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend:** Next.js App Router API Routes, Prisma ORM, Zod Schema Validation.
- **Database:** Supabase PostgreSQL.
- **Keamanan:** Autentikasi sesi berbasis **Secure HttpOnly Cookie** (`wellfora_session`), penandatanganan JWT dengan verifikasi keaktifan akun di database, dan hash password menggunakan **bcrypt**.

---

## 🚀 Panduan Menjalankan Proyek

### 1. Instalasi Dependensi
```bash
npm install
npm --prefix apps/web install
```

Buat `apps/web/.env.local` dengan `DATABASE_URL`, `DIRECT_URL`, dan `JWT_SECRET` acak minimal 32 karakter. Untuk development, jika `DATABASE_URL` atau `JWT_SECRET` belum diset di web, server juga memuat nilainya dari `apps/api/.env`; ubah konfigurasi lalu restart `npm run dev`. `NEXT_PUBLIC_API_URL` tidak perlu diatur; secara default frontend menggunakan API same-origin di `/api`. Pendaftaran mandiri tidak tersedia; permohonan akun karyawan dilakukan oleh HRD setelah login.
Untuk menjalankan perintah database/seed yang masih berada di package lama `apps/api`, instal dependensinya secara terpisah dengan `npm --prefix apps/api install` dan siapkan `apps/api/.env` sesuai `apps/api/.env.example`. Perintah tersebut tidak diperlukan untuk menjalankan aplikasi web.

### 2. Sinkronisasi Skema Database (pengembangan lokal saja)
```bash
npm --prefix apps/api run db:push
```

Seeding hanya untuk database pengembangan terisolasi. Set `SEED_DEMO_DATA=true` dan `SEED_DEMO_PASSWORD` (password unik minimal 12 karakter) sebelum menjalankan `npm run seed`; seeding ditolak pada `NODE_ENV=production` dan menghapus/mengganti data contoh yang dibuatnya. Jangan pernah menjalankannya terhadap data perusahaan.

### 3. Menjalankan Server Pengembangan
Jalankan Next.js, termasuk API Routes:
```bash
npm run dev
```
- Aplikasi web dan API berjalan di: **http://localhost:3000**

### Production

- Gunakan rahasia unik dari secret manager untuk `JWT_SECRET`; jangan gunakan nilai contoh.
- Pendaftaran mandiri dinonaktifkan; gunakan alur permohonan HRD dan persetujuan Superadmin.
- Deployment Vercel menggunakan satu project dengan Root Directory `apps/web` dan framework Next.js. Aktifkan **Include source files outside of the Root Directory in the Build Step**, karena schema Prisma bersama berada di `apps/api/prisma`. Atur `DATABASE_URL`, `DIRECT_URL`, dan `JWT_SECRET` pada project tersebut. `DATABASE_URL` dipakai oleh Prisma Client; `DIRECT_URL` dipakai Prisma untuk koneksi langsung/migrasi. Jangan menaruh credential di repository atau di variabel `NEXT_PUBLIC_*`.
- API Routes berjalan pada Node.js runtime dan menggunakan cookie sesi HttpOnly, Secure di production, serta SameSite=Lax. Login saat ini memakai nomor telepon dan password; OTP tidak digunakan oleh alur login.
- Pembatasan laju API dalam proses Next.js bersifat per-instance. Untuk perlindungan konsisten lintas serverless instances, aktifkan rate limiting terdistribusi melalui layanan edge/Vercel Firewall sebelum membuka deployment ke trafik publik.
- Untuk database production baru, tinjau migration SQL di `apps/api/prisma/migrations`, backup database, lalu jalankan `npm --prefix apps/api run db:migrate:deploy`. Database yang sebelumnya dibuat dengan `db:push` harus dibaseline dengan hati-hati sebelum memakai migration deploy.
- Migration `20261117120000_employee_account_requests` hanya menambahkan tabel permohonan dan tidak menghapus/mengubah data akun yang sudah ada. Jangan jalankan migration di production sebelum backup terverifikasi dan status baseline migration lama dipastikan; database production yang belum memiliki riwayat Prisma perlu ditangani secara terpisah.
- Migration `20261117143000_account_request_approved_role` menambahkan kolom role nullable untuk menyimpan hak akses yang dipilih Superadmin. Terapkan bersama migration lain setelah status baseline database production diverifikasi.
- Jangan gunakan `db:push` atau seed untuk deployment production. `db:push` dan seed ditolak saat `NODE_ENV=production`.
- Jangan memasukkan kredensial nyata ke `.env.example`, source control, log, atau chat. Jika pernah terpapar, rotasi kredensial.
- Pastikan domain memakai HTTPS dan uji login dengan akun untuk setiap role sebelum membuka akses pengguna.

## 📄 Unduh Dokumen PDF

PDF memakai kop divisi, nomor dokumen formal, tabel data dua kolom, badge status, kotak catatan, blok pengesahan elektronik, dan waktu cetak otomatis. Blok pengesahan adalah catatan penerbitan sistem, bukan sertifikat tanda tangan digital tersertifikasi. Dokumen dibuat saat diminta dari data terbaru di database, sehingga status dan catatan mengikuti hasil persetujuan/penyelesaian terakhir. Tombol unduh muncul setelah:

- Surat izin berstatus `APPROVED`; dapat diunduh oleh karyawan pemilik dan HRD.
- Booking konseling berstatus `CONFIRMED` atau `COMPLETED`; dapat diunduh oleh karyawan dan psikolog yang terkait. Catatan klinis hanya dimasukkan setelah sesi selesai.
- Pengaduan hukum berstatus `RESOLVED` atau `CLOSED`; dapat diunduh oleh pelapor dan tim hukum. Identitas pelapor anonim tetap disamarkan, dan catatan internal hukum hanya disertakan pada PDF tim hukum.

PDF tidak disimpan sebagai lampiran terpisah. Unduh dari kartu permohonan, booking, atau kasus pada dashboard masing-masing.

---

## 📄 Ringkasan Endpoint REST API

- `GET /api/health`
- `POST /api/auth/register` (disabled), `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/auth/demo-login` (development only), `POST /api/auth/activate`
- `GET|POST /api/account-requests` (HRD: own requests; Superadmin: all requests), `GET /api/account-requests/:requestId/activation-link` (requesting HRD/Superadmin), `PATCH /api/account-requests/:requestId/decision` (Superadmin)
- `GET /api/leaves`, `POST /api/leaves`, `PATCH /api/leaves/:id/status`, `GET /api/leaves/summary`
- `GET /api/counseling/psychologists`, `GET /api/counseling/availability`, `GET|POST /api/counseling/slots`, `DELETE /api/counseling/slots/:id`
- `GET|POST /api/counseling/bookings`, `PATCH /api/counseling/bookings/:id/status`
- `GET|POST /api/legal/complaints`, `PATCH /api/legal/complaints/:id/status`, `GET /api/legal/summary`
- `GET /api/documents/leaves/:id.pdf`, `GET /api/documents/bookings/:id.pdf`, `GET /api/documents/complaints/:id.pdf`
- `POST /api/atma/chat` *(ATMA risk analysis & escalation; `/api/wellbot/chat` remains as a compatibility alias)*
- `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:userId/login`, `PATCH /api/admin/users/:userId/role`, `PATCH /api/admin/users/:userId/status`, `GET /api/admin/metrics`
- `GET|POST /api/mood`, `GET|POST /api/assessments/dass21`, `GET|POST /api/forum`
