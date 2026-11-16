import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wellfora | Kesejahteraan Mental & Perlindungan Pekerja",
  description: "Platform terpadu untuk pengajuan izin kerja, telekonseling psikolog, ATMA (Asisten Teman Mental Anda), dan perlindungan hukum pekerja berbasis peran (RBAC)."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}