"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { safeRedirectTarget, setStoredUser, WellforaUser, Role } from "@/lib/session";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page min-h-screen bg-[#FBF9F5]" aria-busy="true" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTarget = safeRedirectTarget(searchParams.get("redirect"));

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiRequest<{ message: string; user: WellforaUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, password })
      });
      setStoredUser(response.user);
      router.replace(redirectTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomor telepon atau password tidak sesuai.");
    } finally {
      setLoading(false);
    }
  }

  async function quickRoleLogin(role: Role) {
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest<{ user: WellforaUser; message: string }>("/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ role })
      });
      setStoredUser(res.user);
      const dest: Record<Role, string> = {
        EMPLOYEE: "/dashboard/karyawan",
        HR_ADMIN: "/dashboard/hrd",
        PSYCHOLOGIST: "/dashboard/psikolog",
        LEGAL_COUNSEL: "/dashboard/legal",
        SUPER_ADMIN: "/dashboard/superadmin"
      };
      router.replace(redirectTarget === "/dashboard" ? dest[role] : redirectTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk demo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page min-h-screen bg-[#FBF9F5] flex flex-col md:flex-row">
      {/* Left Aside */}
      <section className="auth-aside md:w-5/12 bg-[#294D3F] text-white p-8 md:p-12 flex flex-col justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-white">
          <span className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
            <Sparkles size={20} />
          </span>
          <span>Wellfora</span>
        </Link>

        <div className="my-12 space-y-4">
          <span className="text-xs uppercase tracking-wider font-bold text-[#B3CEBF]">PORTAL TERINTEGRASI RBAC</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-snug">
            Kesejahteraan mental & keadilan pekerja di satu pintu.
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            Masuk untuk mengakses surat perizinan kerja, telekonseling bersama psikolog berlisensi, konsultasi ATMA (Asisten Teman Mental Anda), serta pendampingan pengaduan hukum.
          </p>
        </div>

        <div className="space-y-3 pt-6 border-t border-white/10 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-300" />
            <span>Autentikasi Terenkripsi & Sesi HttpOnly Cookie</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-300" />
            <span>Hak Akses Berdasarkan 5 Peran (RBAC)</span>
          </div>
        </div>
      </section>

      {/* Right Main Form */}
      <section className="auth-main flex-1 p-6 md:p-12 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A6F66] hover:text-[#294D3F]">
            <ArrowLeft size={14} /> Kembali ke Beranda
          </Link>

          <div>
            <div className="w-10 h-10 rounded-xl bg-[#EAF0EC] text-[#294D3F] flex items-center justify-center mb-3">
              <LockKeyhole size={20} />
            </div>
            <span className="text-[11px] font-bold text-[#4A6B5D] uppercase tracking-wider">AUTENTIKASI AMAN</span>
            <h2 className="text-2xl font-bold text-[#1F382E] mt-1">Masuk ke Wellfora</h2>
            <p className="text-xs text-[#5D7369] mt-1">
              Gunakan nomor telepon dan password terdaftar.
            </p>
          </div>

          <form onSubmit={submitCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#294D3F] mb-1">Nomor Telepon</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxx atau +62xxx"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5CD] bg-white text-sm focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#294D3F] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password akun Anda"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5CD] bg-white text-sm focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#294D3F] text-white text-sm font-bold shadow hover:bg-[#1E392F] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? "Memverifikasi..." : "Masuk"}</span>
                <ArrowRight size={15} />
              </button>
          </form>

          <>
              <div className="text-center text-xs text-[#5D7369]">
                Belum punya akun? Hubungi HRD untuk mengajukan pembuatan akun.{" "}
                <Link href={`/register?redirect=${encodeURIComponent(redirectTarget)}`} className="font-bold text-[#294D3F] underline">
                  Lihat alurnya
                </Link>
              </div>

              {/* Demo Quick Login */}
              <div className="p-4 rounded-2xl bg-white border border-[#E2DBD1] shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#294D3F]">
                  <span>AKSES INSTAN 5 PERAN (DEVELOPMENT):</span>
                  <span className="text-[10px] font-normal text-[#6F8278]">Tidak tersedia di production</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([
                    { role: "EMPLOYEE" as Role, label: "1. Karyawan", phone: "081234567890" },
                    { role: "HR_ADMIN" as Role, label: "2. HRD", phone: "081298765432" },
                    { role: "PSYCHOLOGIST" as Role, label: "3. Psikolog", phone: "081311223344" },
                    { role: "LEGAL_COUNSEL" as Role, label: "4. Legal Counsel", phone: "081355667788" },
                  ]).map((item) => (
                    <button
                      key={item.role}
                      type="button"
                      disabled={loading}
                      onClick={() => quickRoleLogin(item.role)}
                      className="p-2 text-left rounded-lg bg-[#F7FAF8] hover:bg-[#EAF0EC] border border-[#DCE4DF] transition-colors"
                    >
                      <div className="font-bold text-[#1E392F]">{item.label}</div>
                      <div className="text-[10px] text-[#5C7167]">{item.phone}</div>
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => quickRoleLogin("SUPER_ADMIN")}
                    className="col-span-2 p-2 text-left rounded-lg bg-[#F7FAF8] hover:bg-[#EAF0EC] border border-[#DCE4DF] transition-colors"
                  >
                    <div className="font-bold text-[#1E392F]">5. Super Admin</div>
                    <div className="text-[10px] text-[#5C7167]">081122334455 · Kelola akun, deaktivasi resign, master data</div>
                  </button>
                </div>
              </div>
          </>

        </div>
      </section>
    </main>
  );
}
