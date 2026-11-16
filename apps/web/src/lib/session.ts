export type Role = "EMPLOYEE" | "HR_ADMIN" | "PSYCHOLOGIST" | "LEGAL_COUNSEL" | "SUPER_ADMIN";

export type WellforaUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  isActive: boolean;
};

const USER_KEY = "wellfora_user";

export function getStoredUser(): WellforaUser | null {
  if (typeof window === "undefined") return null;
  const data = window.localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as WellforaUser;
  } catch {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: WellforaUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem("mindwork_session");
}

export function safeRedirectTarget(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  if (value.startsWith("/login") || value.startsWith("/register")) {
    return "/dashboard";
  }
  return value;
}

export const ROLE_LABELS: Record<Role, { title: string; badge: string; desc: string }> = {
  EMPLOYEE: {
    title: "Karyawan",
    badge: "Karyawan / Employee",
    desc: "Akses pengajuan surat izin, booking psikolog, ATMA, dan pengaduan kasus hukum."
  },
  HR_ADMIN: {
    title: "HRD",
    badge: "HR Management",
    desc: "Verifikasi & approval surat izin, monitoring keluhan, dan laporan kesejahteraan."
  },
  PSYCHOLOGIST: {
    title: "Psikolog",
    badge: "Psikolog Klinis",
    desc: "Manajemen slot praktik, konfirmasi janji temu konseling, & catatan sesi medis."
  },
  LEGAL_COUNSEL: {
    title: "Tim Hukum / Pengacara",
    badge: "Legal & Compliance",
    desc: "Penanganan laporan pelanggaran hukum & tindak pidana, investigasi, & mediasi."
  },
  SUPER_ADMIN: {
    title: "Superadmin",
    badge: "Super Administrator",
    desc: "Manajemen akun pengguna, deaktivasi karyawan resign, dan master data sistem."
  }
};
