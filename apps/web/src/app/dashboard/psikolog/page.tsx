"use client";

import AccessGuard from "../components/AccessGuard";
import PortalHeader from "../components/PortalHeader";
import PsychologistPanel from "../components/PsychologistPanel";

export default function PsikologPortalPage() {
  return (
    <AccessGuard allowedRoles={["PSYCHOLOGIST"]}>
      {(user) => (
        <div className="min-h-screen bg-[#FBF9F5] text-[#20342F] flex flex-col">
          <PortalHeader user={user} portalName="Portal Layanan Psikolog Klinis" />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <PsychologistPanel user={user} />
          </main>
          <footer className="border-t border-[#E8ECE6] bg-white px-6 py-4 text-center text-xs text-[#7A8E83]">
            Wellfora © 2026 · Portal Layanan Psikolog Klinis (Akses Terbatas: Role PSYCHOLOGIST)
          </footer>
        </div>
      )}
    </AccessGuard>
  );
}

