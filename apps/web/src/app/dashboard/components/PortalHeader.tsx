"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, LogOut, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { clearStoredUser, WellforaUser, ROLE_LABELS } from "@/lib/session";

type Props = {
  user: WellforaUser;
  portalName: string;
};

export default function PortalHeader({ user, portalName }: Props) {
  const router = useRouter();

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

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8ECE6] px-6 py-3.5 flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg text-[#294D3F]">
          <span className="w-8 h-8 rounded-lg bg-[#294D3F] text-white flex items-center justify-center shadow-sm">
            <Sparkles size={18} />
          </span>
          <span>Wellfora</span>
        </Link>

        <span className="hidden sm:inline-block h-4 w-px bg-[#CBD5CD]" />

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#5C7167]">
          <Link href="/" className="hover:text-[#294D3F]">Beranda</Link>
          <ChevronRight size={12} />
          <span className="font-bold text-[#1E392F]">{portalName}</span>
        </div>
      </div>

      {/* Verified Role Badge & User Info */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF0EC] border border-[#CBD5CD] text-[11px] font-bold text-[#294D3F]">
          <Lock size={12} className="text-[#3D6953]" />
          <span>Peran: {ROLE_LABELS[user.role]?.title}</span>
        </div>

        <div className="text-right">
          <div className="text-xs font-bold text-[#1E392F]">{user.name}</div>
          <div className="text-[10px] text-[#71857B]">{user.department || "Operasional"}</div>
        </div>

        <div className="w-8 h-8 rounded-full bg-[#294D3F] text-white font-bold text-xs flex items-center justify-center shadow-sm">
          {user.name.slice(0, 2).toUpperCase()}
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-xl text-[#60746A] hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          title="Keluar dari akun"
          aria-label="Keluar dari akun"
        >
          <LogOut size={16} />
          <span className="hidden md:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}

