"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, LogOut,
  ShieldAlert, ShieldCheck, Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  clearStoredUser, setStoredUser,
  WellforaUser, Role, ROLE_LABELS
} from "@/lib/session";

type Props = {
  allowedRoles: Role[];
  children: (user: WellforaUser) => ReactNode;
};

export default function AccessGuard({ allowedRoles, children }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<WellforaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ user: WellforaUser }>("/auth/me")
      .then((res) => {
        if (res.user) {
          setUser(res.user);
          setStoredUser(res.user);
        } else {
          router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        }
      })
      .catch(() => {
        clearStoredUser();
        setUser(null);
        router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  async function handleLogout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      alert("Tidak dapat mengakhiri sesi saat ini. Periksa koneksi lalu coba lagi.");
      return;
    }
    clearStoredUser();
    router.replace("/login");
  }

  function getOwnPortalUrl(role: Role): string {
    switch (role) {
      case "EMPLOYEE":
        return "/dashboard/karyawan";
      case "HR_ADMIN":
        return "/dashboard/hrd";
      case "PSYCHOLOGIST":
        return "/dashboard/psikolog";
      case "LEGAL_COUNSEL":
        return "/dashboard/legal";
      case "SUPER_ADMIN":
        return "/dashboard/superadmin";
      default:
        return "/dashboard";
    }
  }

  if (loading && !user) {
    return (
      <main className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-[#294D3F]">
        <div className="w-12 h-12 rounded-2xl bg-[#EAF0EC] flex items-center justify-center animate-pulse mb-3">
          <Sparkles size={24} />
        </div>
        <p className="text-sm font-bold">Memverifikasi Hak Akses Peran (RBAC)...</p>
      </main>
    );
  }

  if (!user) return null;

  // STRICT RBAC CHECK: If user role is NOT in allowedRoles, block with 403 Forbidden Shield!
  if (!allowedRoles.includes(user.role)) {
    const targetRoleName = allowedRoles.map((r) => ROLE_LABELS[r]?.title).join(" atau ");
    const userRoleName = ROLE_LABELS[user.role]?.title || user.role;

    return (
      <main className="min-h-screen bg-[#FBF9F5] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert size={36} />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full">
              403 FORBIDDEN · PEMISAHAN HAK AKSES AKTIF
            </span>
            <h1 className="text-2xl font-extrabold text-[#1F382E]">Akses Fitur Ditolak</h1>
            <p className="text-xs text-[#5D7369] leading-relaxed">
              Halaman ini secara ketat hanya dapat diakses oleh pengguna dengan peran <strong>{targetRoleName}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FBF9F5] border border-[#E8ECE6] text-left text-xs space-y-2 text-[#294D3F]">
            <div className="flex justify-between items-center pb-2 border-b border-[#EAEFEA]">
              <span className="text-[#71857B]">Nama Akun Anda:</span>
              <strong className="text-[#1E392F]">{user.name}</strong>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-[#EAEFEA]">
              <span className="text-[#71857B]">Peran Anda Saat Ini:</span>
              <span className="px-2 py-0.5 rounded font-bold bg-[#EAF0EC] text-[#294D3F]">
                {userRoleName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#71857B]">Status Keamanan:</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck size={13} /> RBAC Terisolasi
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href={getOwnPortalUrl(user.role)}
              className="w-full py-3 rounded-xl bg-[#294D3F] text-white text-xs font-bold shadow hover:bg-[#1E392F] transition-all flex items-center justify-center gap-2"
            >
              <span>Buka Portal Resmi Saya ({userRoleName})</span>
              <ArrowRight size={14} />
            </Link>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl border border-[#CBD5CD] text-[#556960] text-xs font-semibold hover:bg-red-50 hover:text-red-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} />
              <span>Keluar & Masuk dengan Akun Lain</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // User is authorized
  return <>{children(user)}</>;
}

