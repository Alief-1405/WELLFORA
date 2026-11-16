import Link from "next/link";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-[#20342F]">
      <div className="w-full max-w-lg space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A6F66] hover:text-[#294D3F]">
          <ArrowLeft size={14} /> Kembali ke Beranda
        </Link>

        <section className="bg-white rounded-3xl p-8 border border-[#E8ECE6] shadow-sm space-y-4">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-[#294D3F]">
            <span className="w-9 h-9 rounded-xl bg-[#EAF0EC] flex items-center justify-center">
              <Sparkles size={20} />
            </span>
            <span>Wellfora</span>
          </Link>
          <div className="w-10 h-10 rounded-xl bg-[#EAF0EC] text-[#294D3F] flex items-center justify-center">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F382E]">Pendaftaran melalui HRD</h1>
            <p className="text-sm text-[#5D7369] mt-2 leading-relaxed">
              Pendaftaran mandiri tidak tersedia. Untuk karyawan baru, hubungi HRD perusahaan agar data nama, nomor telepon, divisi, dan jabatan diajukan ke Superadmin. Akun baru aktif setelah permohonan ditinjau dan disetujui.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-[#294D3F] text-white text-sm font-bold shadow hover:bg-[#1E392F] transition-all"
          >
            Masuk ke Akun
          </Link>
        </section>
      </div>
    </main>
  );
}
