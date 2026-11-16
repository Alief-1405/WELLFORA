"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, ArrowDown, ArrowRight, CalendarDays, CheckCircle2,
  FileText, Heart, Lock, MessageCircle, Scale, ShieldCheck, Sparkles,
  UsersRound, X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { setStoredUser, WellforaUser } from "@/lib/session";
import { apiRequest } from "@/lib/api";

type GatedAction = {
  key: string;
  title: string;
  description: string;
  roleRequired: string;
  destination: string;
  icon: LucideIcon;
  tone: string;
  badge: string;
};

const serviceDirectory: GatedAction[] = [
  {
    key: "leaves",
    title: "Pengajuan Surat Izin",
    description: "Ajukan izin cuti tahunan, izin sakit (lampiran medis), atau dinas luar kota dengan status persetujuan HRD live.",
    roleRequired: "Karyawan",
    destination: "/dashboard/karyawan?tab=leaves",
    icon: FileText,
    tone: "sage",
    badge: "Terintegrasi HRD"
  },
  {
    key: "counseling",
    title: "Booking Konseling Psikolog",
    description: "Jadwalkan sesi telekonseling 1-on-1 privat bersama psikolog berlisensi untuk mengatasi stres, ansietas, dan burnout.",
    roleRequired: "Karyawan",
    destination: "/dashboard/karyawan?tab=counseling",
    icon: CalendarDays,
    tone: "blue",
    badge: "100% Rahasia"
  },
  {
    key: "atma",
    title: "ATMA — Asisten Teman Mental Anda",
    description: "Teman bicara 24/7 dengan deteksi dini tingkat stres dan eskalasi otomatis ke psikolog atau perlindungan hukum.",
    roleRequired: "Karyawan",
    destination: "/dashboard/karyawan?tab=atma",
    icon: MessageCircle,
    tone: "warm",
    badge: "Deteksi Risiko Aktif"
  },
  {
    key: "complaints",
    title: "Pengaduan Hukum & Kasus",
    description: "Laporkan pelecehan, intimidasi, kekerasan fisik, atau pelanggaran hak kerja dengan jaminan perlindungan pelapor (Whistleblower).",
    roleRequired: "Karyawan",
    destination: "/dashboard/karyawan?tab=complaints",
    icon: Scale,
    tone: "pink",
    badge: "Dampingan Advokat"
  },
  {
    key: "assessment",
    title: "Asesmen DASS-21",
    description: "Skrining mandiri 21 pertanyaan terstandar untuk memetakan tingkat depresi, kecemasan, dan stres kerja dalam 7 hari terakhir.",
    roleRequired: "Karyawan",
    destination: "/dashboard/karyawan?tab=overview",
    icon: Activity,
    tone: "blue",
    badge: "Skrining Klinis"
  },
  {
    key: "forum",
    title: "Ruang Cerita Anonim",
    description: "Berbagi cerita dan beban emosional di tempat kerja dengan nama samaran (pseudonym) dalam komunitas rekan kerja yang suportif.",
    roleRequired: "Karyawan",
    destination: "/dashboard/karyawan?tab=overview",
    icon: UsersRound,
    tone: "warm",
    badge: "Pseudonym ID"
  }
];

const educationArticles = [
  {
    title: "Mengenali Burnout vs Kelelahan Biasa di Tempat Kerja",
    category: "Kesehatan Mental",
    readTime: "4 menit baca",
    summary: "Kelelahan biasa dapat pulih setelah istirahat akhir pekan, namun burnout ditandai dengan sinisme kronis, hilangnya rasa pencapaian, dan kepenatan emosional berkepanjangan.",
    tips: ["Terapkan batasan tegas pada jam pesan instan kantor", "Gunakan hak cuti pemulihan sebelum stres menjadi somatis", "Konsultasikan dengan psikolog jika mengalami gangguan tidur berkala"]
  },
  {
    title: "Hak Karyawan: Regulasi Cuti, Sakit, & Batas Jam Lembur",
    category: "Perlindungan Hukum Kerja",
    readTime: "5 menit baca",
    summary: "Berdasarkan regulasi ketenagakerjaan, pekerja berhak atas waktu istirahat mingguan, batas lembur maksimal 4 jam sehari (18 jam seminggu), serta hak cuti sakit dengan upah penuh.",
    tips: ["Lampirkan surat keterangan dokter untuk verifikasi izin sakit resmi", "Pemberi kerja wajib memberikan kompensasi upah lembur resmi", "Laporkan pemaksaan jam kerja di luar regulasi ke kanal kepatuhan"]
  },
  {
    title: "Mengenali Pelecehan di Lingkungan Kerja & Whistleblower Protection",
    category: "Keamanan Kerja",
    readTime: "6 menit baca",
    summary: "Pelecehan tidak hanya berupa fisik, namun juga verbal, pesan bernuansa seksual, atau lelucon merendahkan. Sistem Wellfora menjamin identitas pelapor tetap aman dan rahasia.",
    tips: ["Dokumentasikan tanggal, saksi, dan bukti percakapan", "Manfaatkan opsi pelaporan anonim pada fitur Pengaduan Hukum", "Advokat hukum Wellfora bertugas mengawal investigasi tanpa intimidasi"]
  }
];

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<WellforaUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<GatedAction | null>(null);

  useEffect(() => {
    apiRequest<{ user: WellforaUser }>("/auth/me")
      .then((res) => {
        if (res.user) {
          setCurrentUser(res.user);
          setStoredUser(res.user);
        }
      })
      .catch(() => {
        // Guest mode, not logged in
      });
  }, []);

  function handleActionClick(action: GatedAction) {
    if (currentUser) {
      router.push(action.destination);
    } else {
      setSelectedAction(action);
      setModalOpen(true);
    }
  }

  return (
    <main className="landing-page min-h-screen bg-[#FBF9F5] text-[#20342F]">
      {/* Header Publik */}
      <header className="landing-header sticky top-0 z-40 border-b border-[#E8ECE6] bg-[#FBF9F5]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-[#294D3F]">
          <span className="w-9 h-9 rounded-xl bg-[#294D3F] text-white flex items-center justify-center shadow-sm">
            <Sparkles size={20} />
          </span>
          <span>Wellfora</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#5A6F66]">
          <a href="#layanan" className="hover:text-[#294D3F] transition-colors">Direktori Layanan</a>
          <a href="#edukasi" className="hover:text-[#294D3F] transition-colors">Edukasi & Perlindungan</a>
          <a href="#alur" className="hover:text-[#294D3F] transition-colors">Alur Pelacakan</a>
          <a href="#tentang" className="hover:text-[#294D3F] transition-colors">Tentang Wellfora</a>
        </nav>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#294D3F] text-white text-sm font-bold shadow-sm hover:bg-[#1E392F] transition-all"
            >
              <span>Ruang Kerja ({currentUser.name.split(" ")[0]})</span>
              <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[#294D3F] hover:bg-[#EAF0EC] transition-all"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#294D3F] text-white text-sm font-bold shadow-sm hover:bg-[#1E392F] transition-all"
              >
                <span>Akun melalui HRD</span>
                <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-16 md:py-24 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4ECE6] text-[#294D3F] text-xs font-bold tracking-wide uppercase">
            <ShieldCheck size={14} /> Platform Kesejahteraan Mental & Perlindungan Pekerja
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1B362C] leading-tight">
            Ruang aman untuk merasa, <em className="italic font-serif text-[#4A6B5D]">hak terlindungi untuk bekerja.</em>
          </h1>

          <p className="text-base sm:text-lg text-[#5A6F66] leading-relaxed">
            Wellfora menghadirkan ekosistem terpadu: perizinan kerja transparan, konseling psikolog profesional, ATMA (Asisten Teman Mental Anda) 24/7, dan perlindungan hukum pekerja dari pelecehan serta intimidasi.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#layanan"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#294D3F] text-white text-sm font-bold shadow hover:bg-[#1E392F] transition-all"
            >
              <span>Jelajahi Fitur Terpadu</span>
              <ArrowDown size={16} />
            </a>
            <button
              onClick={() => {
                setSelectedAction(serviceDirectory[0]);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-[#C5D2CA] text-[#294D3F] text-sm font-semibold hover:bg-white transition-all"
            >
              <Lock size={15} className="text-[#5A6F66]" />
              <span>Coba Demo 5 Role UAS</span>
            </button>
          </div>

          <div className="flex items-center gap-6 pt-4 text-xs font-medium text-[#64796F]">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-[#3D6953]" /> 100% Enkripsi Privasi</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-[#3D6953]" /> Sesuai Regulasi Ketenagakerjaan</span>
          </div>
        </div>

        {/* Visual Card / Illustration Graphic */}
        <div className="relative w-full max-w-md bg-gradient-to-br from-[#2D5344] to-[#1E3A2E] rounded-3xl p-8 text-white shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#B3CEBF]">Wellfora Live Core</span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium text-[#C8E0D2] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> RBAC Terpadu
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Heart size={20} className="text-[#D3E8DC]" />
                </div>
                <div>
                  <div className="text-sm font-bold">Kesejahteraan & Pemulihan</div>
                  <div className="text-xs text-white/70">Check-in emosi & telekonseling privat</div>
                </div>
              </div>
              <div className="text-xs italic text-white/80 border-t border-white/10 pt-2">
                &ldquo;Pelan-pelan juga tetap sebuah kemajuan yang bermakna.&rdquo;
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-xs text-white/70">Surat Izin HRD</div>
                <div className="text-sm font-bold mt-1 text-emerald-200">Live Status Tracker</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-xs text-white/70">Perlindungan Hukum</div>
                <div className="text-sm font-bold mt-1 text-amber-200">Whistleblower Pro</div>
              </div>
            </div>

            <div className="text-xs text-white/60 flex items-center justify-between pt-2">
              <span>Mode Tamu Aktif</span>
              <span>Klik kartu untuk mencoba</span>
            </div>
          </div>
        </div>
      </section>

      {/* Guest Mode & Gated Action Service Directory */}
      <section id="layanan" className="px-6 py-20 bg-white border-y border-[#E8ECE6]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#4A6B5D] tracking-widest uppercase">DIREKTORI FITUR & LAYANAN TERPADU</span>
              <h2 className="text-3xl font-extrabold text-[#1F382E]">Akses Terbuka untuk Publik, Terproteksi Saat Beraksi</h2>
              <p className="text-sm text-[#5C7167] max-w-xl">
                Jelajahi informasi platform dengan bebas. Saat kamu memilih untuk mengajukan atau berkonsultasi, sistem mengamankannya dengan verifikasi peran (RBAC).
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F2F6F3] text-[#294D3F]">
              <Lock size={14} /> Gated Actions: Otomatis minta login jika belum masuk
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceDirectory.map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.key}
                  className="group relative bg-[#FBF9F5] border border-[#E8ECE6] hover:border-[#3D6953] rounded-2xl p-6 transition-all duration-200 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl bg-[#EAF0EC] text-[#294D3F] flex items-center justify-center group-hover:bg-[#294D3F] group-hover:text-white transition-colors">
                        <Icon size={22} />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white border border-[#E0E7E2] text-[#4A6B5D]">
                        {action.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-[#1E392F] group-hover:text-[#294D3F]">{action.title}</h3>
                      <p className="text-xs text-[#5D7369] mt-2 leading-relaxed">{action.description}</p>
                    </div>
                  </div>

                  <div className="pt-6 mt-4 border-t border-[#EAEFEA] flex items-center justify-between">
                    <span className="text-[11px] text-[#788E83] font-medium">Peran: {action.roleRequired}</span>
                    <button
                      onClick={() => handleActionClick(action)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#294D3F] group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>Akses Fitur</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Edukasi Kesehatan Mental & Perlindungan Pekerja */}
      <section id="edukasi" className="px-6 py-20 max-w-6xl mx-auto space-y-12">
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#4A6B5D] tracking-widest uppercase">EDUKASI KESEJAHTERAAN & HUKUM PEKERJA</span>
          <h2 className="text-3xl font-extrabold text-[#1F382E]">Pengetahuan untuk Ruang Kerja yang Sehat & Adil</h2>
          <p className="text-sm text-[#5C7167] max-w-xl">
            Semua artikel edukatif ini dapat diakses secara bebas tanpa perlu login, sebagai komitmen keterbukaan informasi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {educationArticles.map((art, idx) => (
            <article key={idx} className="bg-white border border-[#E8ECE6] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#70857A]">
                  <span className="font-bold text-[#294D3F] uppercase tracking-wider text-[10px] bg-[#EAF0EC] px-2 py-0.5 rounded">
                    {art.category}
                  </span>
                  <span>{art.readTime}</span>
                </div>
                <h3 className="text-base font-bold text-[#1E392F] leading-snug">{art.title}</h3>
                <p className="text-xs text-[#5D7369] leading-relaxed">{art.summary}</p>

                <div className="pt-3 border-t border-[#F0F3EF] space-y-2">
                  <div className="text-[11px] font-bold text-[#294D3F]">Panduan Utama:</div>
                  <ul className="space-y-1 text-xs text-[#5D7369]">
                    {art.tips.map((tip, tIdx) => (
                      <li key={tIdx} className="flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="text-[#3D6953] mt-0.5 shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F0F3EF]">
                <button
                  onClick={() => {
                    setSelectedAction(serviceDirectory[idx]);
                    setModalOpen(true);
                  }}
                  className="w-full py-2 rounded-lg bg-[#F4F7F4] hover:bg-[#EAF0EC] text-xs font-bold text-[#294D3F] transition-colors"
                >
                  Konsultasikan Topik Ini
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Alur Live Status Tracker (Workflow Transparency) */}
      <section id="alur" className="px-6 py-20 bg-[#F4F1EA] border-t border-[#E8ECE6]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold text-[#4A6B5D] tracking-widest uppercase">TRANSPARANSI PROSES TERPADU</span>
            <h2 className="text-3xl font-extrabold text-[#1F382E]">Live Status & Approval Tracker</h2>
            <p className="text-sm text-[#5C7167]">
              Setiap permohonan izin kerja, janji temu psikolog, dan laporan kasus hukum memiliki alur status transparan dengan riwayat yang dapat dipantau langsung.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tracker 1: Surat Izin */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2DBD1] shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF0EC] text-[#294D3F] flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E392F]">Surat Izin (Cuti/Sakit/Dinas)</h4>
                  <span className="text-xs text-[#7A8E83]">Verifikasi oleh Tim HRD</span>
                </div>
              </div>
              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#EAF0EC] text-[#294D3F] font-bold flex items-center justify-center shrink-0">1</span>
                  <span><strong>Diajukan (Submitted):</strong> Karyawan mengisi form & alasan</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">2</span>
                  <span><strong>Ditinjau (In Review):</strong> HRD memverifikasi sisa cuti/surat dokter</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">3</span>
                  <span><strong>Keputusan (Approved / Rejected):</strong> Catatan resmi diterbitkan</span>
                </div>
              </div>
            </div>

            {/* Tracker 2: Konseling Psikolog */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2DBD1] shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E392F]">Booking Konseling Psikolog</h4>
                  <span className="text-xs text-[#7A8E83]">Tatap Muka & Telehealth</span>
                </div>
              </div>
              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">1</span>
                  <span><strong>Booking Masuk:</strong> Pemilihan jadwal & keluhan awal</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">2</span>
                  <span><strong>Dikonfirmasi:</strong> Psikolog menyetujui slot waktu & tautan sesi</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">3</span>
                  <span><strong>Selesai (Completed):</strong> Catatan klinis & rencana aksi diarsipkan</span>
                </div>
              </div>
            </div>

            {/* Tracker 3: Pengaduan Hukum */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2DBD1] shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Scale size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1E392F]">Pengaduan & Kasus Hukum</h4>
                  <span className="text-xs text-[#7A8E83]">Tim Advokat & Kepatuhan</span>
                </div>
              </div>
              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0">1</span>
                  <span><strong>Tiket Diterbitkan:</strong> Laporan masuk dengan kode rahasia</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">2</span>
                  <span><strong>Investigasi:</strong> Pengumpulan fakta saksi & bukti otentik</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">3</span>
                  <span><strong>Mediasi / Sanksi:</strong> Penegakan hukum & pemulihan korban</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 max-w-6xl mx-auto border-t border-[#E8ECE6] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#73877D]">
        <div className="flex items-center gap-2 font-bold text-sm text-[#294D3F]">
          <Sparkles size={16} /> Wellfora © 2026
        </div>
        <div>Aplikasi Kesejahteraan Mental & Perlindungan Pekerja (Proyek UAS Full-Stack RBAC)</div>
        <div className="flex items-center gap-4">
          <a href="#layanan" className="hover:text-[#294D3F]">Fitur</a>
          <a href="#edukasi" className="hover:text-[#294D3F]">Edukasi</a>
          <Link href="/login" className="hover:text-[#294D3F]">Masuk</Link>
        </div>
      </footer>

      {/* Gated Action Modal (E-Commerce Style Login Interceptor) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-6">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center transition-colors"
              aria-label="Tutup modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF0EC] text-[#294D3F] flex items-center justify-center shrink-0">
                <Lock size={22} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">AKSES TERPROTEKSI (GATED ACTION)</span>
                <h3 className="text-xl font-bold text-[#1E392F]">
                  {selectedAction ? selectedAction.title : "Fitur Khusus Pengguna"}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#5C7167] leading-relaxed">
              Untuk mengakses fitur <strong>{selectedAction?.title}</strong>, Anda perlu masuk ke akun terverifikasi agar riwayat permohonan, jadwal, dan privasi Anda tercatat aman.
            </p>

            <div className="grid gap-3 pt-2 grid-cols-1">
              <Link
                href={`/login?redirect=${encodeURIComponent(selectedAction?.destination || "/dashboard")}`}
                className="py-3 px-4 rounded-xl bg-[#294D3F] text-white text-center text-xs sm:text-sm font-bold shadow hover:bg-[#1E392F] transition-all flex items-center justify-center gap-1.5"
              >
                <span>Masuk Akun</span>
                <ArrowRight size={14} />
              </Link>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
