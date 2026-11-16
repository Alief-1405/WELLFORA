"use client";

import { Suspense } from "react";
import AccessGuard from "../components/AccessGuard";
import PortalHeader from "../components/PortalHeader";
import EmployeePanel from "../components/EmployeePanel";

export default function KaryawanPortalPage() {
  return (
    <AccessGuard allowedRoles={["EMPLOYEE"]}>
      {(user) => (
        <div className="min-h-screen bg-[#FBF9F5] text-[#20342F] flex flex-col">
          <PortalHeader user={user} portalName="Portal Mandiri Karyawan" />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <Suspense fallback={<div className="min-h-96" aria-busy="true" />}>
              <EmployeePanel user={user} />
            </Suspense>
          </main>
          <footer className="border-t border-[#E8ECE6] bg-white px-6 py-4 text-center text-xs text-[#7A8E83]">
            Wellfora © 2026 · Portal Mandiri Karyawan (Akses Terbatas: Role EMPLOYEE)
          </footer>
        </div>
      )}
    </AccessGuard>
  );
}

