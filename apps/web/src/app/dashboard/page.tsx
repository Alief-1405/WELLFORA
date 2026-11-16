"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getStoredUser, setStoredUser, WellforaUser, Role } from "@/lib/session";

export default function DashboardDispatcherPage() {
  const router = useRouter();
  useEffect(() => {
    function routeByRole(role: Role) {
      switch (role) {
        case "EMPLOYEE":
          router.replace("/dashboard/karyawan");
          break;
        case "HR_ADMIN":
          router.replace("/dashboard/hrd");
          break;
        case "PSYCHOLOGIST":
          router.replace("/dashboard/psikolog");
          break;
        case "LEGAL_COUNSEL":
          router.replace("/dashboard/legal");
          break;
        case "SUPER_ADMIN":
          router.replace("/dashboard/superadmin");
          break;
        default:
          router.replace("/login");
      }
    }

    const cached = getStoredUser();
    if (cached) {
      routeByRole(cached.role);
      return;
    }

    apiRequest<{ user: WellforaUser }>("/auth/me")
      .then((res) => {
        if (res.user) {
          setStoredUser(res.user);
          routeByRole(res.user.role);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  return (
    <main className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-[#294D3F]">
      <div className="w-12 h-12 rounded-2xl bg-[#EAF0EC] flex items-center justify-center animate-pulse mb-3">
        <Sparkles size={24} />
      </div>
      <p className="text-sm font-bold">Mengarahkan ke Portal Resmi Sesuai Peran Anda...</p>
      <span className="text-xs text-[#71857B] mt-1">Role-Based Access Control (RBAC)</span>
    </main>
  );
}
