"use client";

import AccessGuard from "../components/AccessGuard";
import PortalHeader from "../components/PortalHeader";
import SuperadminPanel from "../components/SuperadminPanel";

export default function SuperadminPortalPage() {
  return (
    <AccessGuard allowedRoles={["SUPER_ADMIN"]}>
      {(user) => (
        <div className="min-h-screen bg-[#FBF9F5] text-[#20342F] flex flex-col">
          <PortalHeader user={user} portalName="Pusat Kendali Superadmin" />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <SuperadminPanel />
          </main>
          <footer className="border-t border-[#E8ECE6] bg-white px-6 py-4 text-center text-xs text-[#7A8E83]">
            Wellfora © 2026 · Pusat Kendali Master Superadmin (Akses Terbatas: Role SUPER_ADMIN)
          </footer>
        </div>
      )}
    </AccessGuard>
  );
}

