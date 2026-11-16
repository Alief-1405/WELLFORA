"use client";

import AccessGuard from "../components/AccessGuard";
import PortalHeader from "../components/PortalHeader";
import HrPanel from "../components/HrPanel";

export default function HrdPortalPage() {
  return (
    <AccessGuard allowedRoles={["HR_ADMIN"]}>
      {(user) => (
        <div className="min-h-screen bg-[#FBF9F5] text-[#20342F] flex flex-col">
          <PortalHeader user={user} portalName="Portal Manajemen HRD" />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <HrPanel user={user} />
          </main>
          <footer className="border-t border-[#E8ECE6] bg-white px-6 py-4 text-center text-xs text-[#7A8E83]">
            Wellfora © 2026 · Portal Manajemen HRD (Akses Terbatas: Role HR_ADMIN)
          </footer>
        </div>
      )}
    </AccessGuard>
  );
}

