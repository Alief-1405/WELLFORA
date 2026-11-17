"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import {
  CheckCircle2, Search, UserMinus, UserPlus, X
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Role, ROLE_LABELS } from "@/lib/session";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
};

type Metrics = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: Record<string, number>;
  totalLeaves: number;
  totalBookings: number;
  totalComplaints: number;
};

type EmployeeAccountRequest = {
  id: string;
  name: string;
  phone: string;
  department: string;
  position: string;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  approvedRole: Role | null;
  createdAt: string;
  reviewedAt: string | null;
  requestedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  createdUser: { id: string; name: string; role: Role } | null;
};

export default function SuperadminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [accountRequests, setAccountRequests] = useState<EmployeeAccountRequest[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EmployeeAccountRequest | null>(null);
  const [requestRole, setRequestRole] = useState<Role | "">("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [modalType, setModalType] = useState<"ROLE" | "CREATE" | "LOGIN" | null>(null);

  // New user form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("EMPLOYEE");
  const [newDept, setNewDept] = useState("Operasional");
  const [newPosition, setNewPosition] = useState("Staf");

  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Change role state
  const [targetRole, setTargetRole] = useState<Role>("EMPLOYEE");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(async () => {
    try {
      let query = "?";
      if (roleFilter !== "ALL") query += `role=${roleFilter}&`;
      if (activeFilter !== "ALL") query += `isActive=${activeFilter === "ACTIVE" ? "true" : "false"}&`;
      if (searchQuery.trim()) query += `search=${encodeURIComponent(searchQuery.trim())}&`;

      const [uRes, mRes, rRes] = await Promise.all([
        apiRequest<{ users: AdminUser[] }>(`/admin/users${query}`),
        apiRequest<{ metrics: Metrics }>("/admin/metrics"),
        apiRequest<{ requests: EmployeeAccountRequest[] }>("/account-requests")
      ]);
      setUsers(uRes.users);
      setMetrics(mRes.metrics);
      setAccountRequests(rRes.requests);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data administrasi.");
    }
  }, [roleFilter, activeFilter, searchQuery]);

  async function handleAccountRequestDecision(decision: "APPROVED" | "REJECTED") {
    if (!selectedRequest) return;
    let payload: { decision: "APPROVED"; role: Role } | { decision: "REJECTED"; rejectionReason: string };
    if (decision === "APPROVED") {
      if (!requestRole) {
        alert("Pilih hak akses berdasarkan divisi dan jabatan.");
        return;
      }
      payload = { decision, role: requestRole };
    } else {
      if (rejectionReason.trim().length < 5) {
        alert("Alasan penolakan minimal 5 karakter.");
        return;
      }
      payload = { decision, rejectionReason };
    }

    setLoading(true);
    try {
      const response = await apiRequest<{ message: string; request: EmployeeAccountRequest }>(
        `/account-requests/${selectedRequest.id}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify(payload)
        }
      );
      setMessage(response.message);
      setSelectedRequest(null);
      setRejectionReason("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memproses permohonan akun.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Toggle Active Status (Resigned Employee Deactivation)
  async function toggleStatus(target: AdminUser) {
    const nextStatus = !target.isActive;
    const actionLabel = nextStatus ? "mengaktifkan kembali" : "menonaktifkan (karyawan resign)";
    if (!confirm(`Apakah Anda yakin ingin ${actionLabel} akun ${target.name}?`)) return;

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; user: AdminUser }>(`/admin/users/${target.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextStatus })
      });
      setMessage(res.message);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui status akun");
    } finally {
      setLoading(false);
    }
  }

  // Change Role
  async function handleChangeRole() {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; user: AdminUser }>(`/admin/users/${selectedUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: targetRole })
      });
      setMessage(res.message);
      setSelectedUser(null);
      setModalType(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah role");
    } finally {
      setLoading(false);
    }
  }

  // Create User
  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; user: AdminUser }>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
          role: newRole,
          department: newDept,
          position: newPosition
        })
      });
      setMessage(res.message);
      setModalType(null);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal membuat pengguna baru");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateLogin(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; user: AdminUser }>(`/admin/users/${selectedUser.id}/login`, {
        method: "PATCH",
        body: JSON.stringify({
          phone: loginPhone,
          ...(loginPassword ? { password: loginPassword } : {})
        })
      });
      setMessage(res.message);
      setModalType(null);
      setSelectedUser(null);
      setLoginPassword("");
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui akses login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {loadError && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{loadError}</div>}
      {/* Header Banner */}
      <div className="bg-[#294D3F] text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">MASTER SISTEM & KONTROL KEAMANAN</span>
          <h2 className="text-2xl font-extrabold">Pusat Kendali Superadmin</h2>
          <p className="text-xs text-[#D1DFD5] leading-relaxed">
            Kelola seluruh akun pengguna, lakukan deaktivasi akun karyawan resign, atur hak akses peran (RBAC), serta pantau statistik sistem secara real-time.
          </p>
        </div>
        <button
          onClick={() => setModalType("CREATE")}
          className="px-4 py-2.5 rounded-xl bg-white text-[#294D3F] text-xs font-bold hover:bg-[#EAF0EC] shadow-sm transition-all flex items-center gap-2"
        >
          <UserPlus size={16} />
          <span>Tambah Akun Baru</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-[#71857B]">Total Pengguna</div>
          <div className="text-2xl font-extrabold text-[#1E392F] mt-1">{metrics?.totalUsers ?? 0}</div>
          <div className="text-[11px] text-[#5C7167] mt-0.5">{metrics?.activeUsers ?? 0} aktif · {metrics?.inactiveUsers ?? 0} non-aktif</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-[#71857B]">Surat Izin HRD</div>
          <div className="text-2xl font-extrabold text-[#1E392F] mt-1">{metrics?.totalLeaves ?? 0}</div>
          <div className="text-[11px] text-[#5C7167] mt-0.5">Transaksi perizinan</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-[#71857B]">Janji Konseling</div>
          <div className="text-2xl font-extrabold text-[#1E392F] mt-1">{metrics?.totalBookings ?? 0}</div>
          <div className="text-[11px] text-[#5C7167] mt-0.5">Sesi psikolog terdaftar</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-[#71857B]">Pengaduan Hukum</div>
          <div className="text-2xl font-extrabold text-[#1E392F] mt-1">{metrics?.totalComplaints ?? 0}</div>
          <div className="text-[11px] text-[#5C7167] mt-0.5">Kasus perlindungan pekerja</div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      <section className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-bold text-[#1E392F]">Antrean Permohonan Akun Karyawan</h3>
          <p className="text-xs text-[#5D7369] mt-1">
            Periksa identitas, nomor telepon, divisi, dan jabatan. Akun hanya dibuat setelah disetujui; role yang dibuat adalah Karyawan.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8ECE6] text-[#71857B] font-bold">
                <th className="py-3 px-3">Calon Karyawan</th>
                <th className="py-3 px-3">Divisi & Jabatan</th>
                <th className="py-3 px-3">Diajukan oleh HRD</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4F1]">
              {accountRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#7A8E83]">
                    Belum ada permohonan akun.
                  </td>
                </tr>
              ) : accountRequests.map((request) => (
                <tr key={request.id} className="hover:bg-[#FBF9F5]">
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#1E392F]">{request.name}</div>
                    <div className="text-[11px] text-[#5C7167]">{request.phone}</div>
                    {request.notes && <div className="mt-1 text-[10px] text-[#556960]">{request.notes}</div>}
                  </td>
                  <td className="py-3 px-3 text-[#556960]">
                    <div>{request.department}</div>
                    <div className="text-[10px] text-[#788E83]">{request.position}</div>
                  </td>
                  <td className="py-3 px-3 text-[#556960]">
                    <div>{request.requestedBy.name}</div>
                    <div className="text-[10px]">{new Date(request.createdAt).toLocaleDateString("id-ID")}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${request.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : request.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                      {request.status === "PENDING" ? "Menunggu" : request.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                    </span>
                    {request.createdUser ? (
                      <div className="mt-1 text-[10px] text-[#3D6953]">
                        Akun aktif: {request.createdUser.name} · {ROLE_LABELS[request.createdUser.role].title}
                      </div>
                    ) : request.status === "APPROVED" ? (
                      <div className="mt-1 text-[10px] text-[#71857B]">
                        {request.approvedRole ? `Akses: ${ROLE_LABELS[request.approvedRole].title}. ` : ""}
                        Menunggu aktivasi oleh karyawan.
                      </div>
                    ) : null}
                    {request.rejectionReason && <div className="mt-1 text-[10px] text-red-700">{request.rejectionReason}</div>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {request.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(request);
                          setRequestRole("");
                          setRejectionReason("");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#EAF0EC] hover:bg-[#294D3F] hover:text-white text-[#294D3F] font-bold text-[11px] transition-all"
                      >
                        Tinjau & Putuskan
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#71857B]">
                        {request.reviewedBy ? `Ditinjau ${request.reviewedBy.name}` : "Selesai"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* User Management Table */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1E392F]">Manajemen Akun Pengguna</h3>
            <p className="text-xs text-[#5D7369]">
              Kelola status keaktifan (deaktivasi karyawan resign) dan ubah hak akses (RBAC).
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#7A8E83]" />
              <input
                type="text"
                placeholder="Cari nama / email / divisi..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[#CBD5CD] text-xs focus:outline-none focus:border-[#294D3F]"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#CBD5CD] bg-[#FBF9F5] text-xs font-bold text-[#556960] focus:outline-none"
            >
              <option value="ALL">Semua Peran</option>
              <option value="EMPLOYEE">Karyawan</option>
              <option value="HR_ADMIN">HRD</option>
              <option value="PSYCHOLOGIST">Psikolog</option>
              <option value="LEGAL_COUNSEL">Legal Counsel</option>
              <option value="SUPER_ADMIN">Superadmin</option>
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#CBD5CD] bg-[#FBF9F5] text-xs font-bold text-[#556960] focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif / Resign</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8ECE6] text-[#71857B] font-bold">
                <th className="py-3 px-3">Nama Pengguna & Email</th>
                <th className="py-3 px-3">Nomor Login</th>
                <th className="py-3 px-3">Divisi & Posisi</th>
                <th className="py-3 px-3">Peran (Role)</th>
                <th className="py-3 px-3">Status Akun</th>
                <th className="py-3 px-3 text-right">Kontrol Superadmin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4F1]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FBF9F5] transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-[#1E392F]">{u.name}</div>
                    <div className="text-[11px] text-[#5C7167]">{u.email}</div>
                  </td>
                  <td className="py-3.5 px-3 text-[#556960]">{u.phone || "Belum diatur"}</td>
                  <td className="py-3.5 px-3 text-[#556960]">
                    <div>{u.department || "-"}</div>
                    <div className="text-[10px] text-[#788E83]">{u.position || "-"}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-[#EAF0EC] text-[#294D3F]">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    {u.isActive ? (
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                        <CheckCircle2 size={11} /> Aktif Bekerja
                      </span>
                    ) : (
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 flex items-center gap-1 w-max">
                        <UserMinus size={11} /> Non-aktif (Resign)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setLoginPhone(u.phone || "");
                          setLoginPassword("");
                          setModalType("LOGIN");
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#CBD5CD] hover:bg-[#EAF0EC] font-bold text-[11px] text-[#294D3F] transition-colors"
                        title="Atur nomor telepon dan password login"
                      >
                        Atur Login
                      </button>

                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setTargetRole(u.role);
                          setModalType("ROLE");
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#CBD5CD] hover:bg-[#EAF0EC] font-bold text-[11px] text-[#294D3F] transition-colors"
                        title="Ubah Peran"
                      >
                        Ubah Role
                      </button>

                      <button
                        onClick={() => toggleStatus(u)}
                        className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${u.isActive ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                        title={u.isActive ? "Deaktivasi Karyawan Resign" : "Aktifkan Kembali Akun"}
                      >
                        {u.isActive ? "Nonaktifkan (Resign)" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ubah Role */}
      {modalType === "ROLE" && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              onClick={() => { setModalType(null); setSelectedUser(null); }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">PENGATURAN RBAC</span>
              <h3 className="text-xl font-bold text-[#1E392F]">Ubah Peran Pengguna</h3>
              <p className="text-xs text-[#5D7369]">{selectedUser.name} ({selectedUser.email})</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Pilih Peran Baru</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as Role)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                >
                  <option value="EMPLOYEE">Karyawan (Employee)</option>
                  <option value="HR_ADMIN">HRD (HR Admin)</option>
                  <option value="PSYCHOLOGIST">Psikolog Klinis (Psychologist)</option>
                  <option value="LEGAL_COUNSEL">Tim Hukum & Advokat (Legal Counsel)</option>
                  <option value="SUPER_ADMIN">Superadmin</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#CBD5CD] text-[11px] text-[#556960]">
                {ROLE_LABELS[targetRole]?.desc}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleChangeRole}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold text-xs shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Perubahan Peran"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === "LOGIN" && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              type="button"
              onClick={() => { setModalType(null); setSelectedUser(null); }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">AKSES AKUN</span>
              <h3 className="text-xl font-bold text-[#1E392F]">Atur Login Pengguna</h3>
              <p className="text-xs text-[#5D7369]">{selectedUser.name} · {selectedUser.role}</p>
            </div>

            <form onSubmit={handleUpdateLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Nomor Telepon untuk Login</label>
                <input
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="08xxx atau +62xxx"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Password Baru (opsional)</label>
                <input
                  type="password"
                  minLength={12}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Kosongkan jika password lama masih diketahui"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
                <p className="text-[10px] text-[#71857B] mt-1">Jika diisi, minimal 12 karakter.</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold text-xs shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Akses Login"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Akun Baru */}
      {modalType === "CREATE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              onClick={() => setModalType(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">MASTER USER</span>
              <h3 className="text-xl font-bold text-[#1E392F]">Tambah Pengguna Baru</h3>
              <p className="text-xs text-[#5D7369]">Buat akun karyawan, psikolog, atau tim hukum baru secara manual.</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama lengkap..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@wellfora.com"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Nomor Telepon untuk Login</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="08xxx atau +62xxx"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Peran (Role)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                  >
                    <option value="EMPLOYEE">Karyawan</option>
                    <option value="HR_ADMIN">HRD</option>
                    <option value="PSYCHOLOGIST">Psikolog</option>
                    <option value="LEGAL_COUNSEL">Legal Counsel</option>
                    <option value="SUPER_ADMIN">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Password Awal</label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 12 karakter"
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Departemen</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Jabatan / Posisi</label>
                  <input
                    type="text"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold text-xs shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Daftarkan Pengguna"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              type="button"
              onClick={() => {
                setSelectedRequest(null);
                setRejectionReason("");
              }}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">TINJAU PERMOHONAN HRD</span>
              <h3 className="text-xl font-bold text-[#1E392F]">{selectedRequest.name}</h3>
              <p className="text-xs text-[#5D7369] mt-1">
                {selectedRequest.phone} · {selectedRequest.department} · {selectedRequest.position}
              </p>
              <p className="text-[11px] text-[#71857B] mt-1">
                Diajukan oleh {selectedRequest.requestedBy.name} pada {new Date(selectedRequest.createdAt).toLocaleDateString("id-ID")}.
              </p>
            </div>

            {selectedRequest.notes && (
              <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6] text-xs text-[#556960]">
                <strong>Catatan HRD:</strong> {selectedRequest.notes}
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#EAF0EC] text-[11px] text-[#294D3F]">
              Pilih hak akses berdasarkan divisi dan jabatan yang diajukan. Jika disetujui, HRD membagikan tautan aktivasi dan karyawan membuat password sendiri. Role Superadmin hanya dapat diberikan melalui pengelolaan akun manual.
            </div>

            <div>
              <label htmlFor="request-role" className="mb-1 block text-xs font-bold text-[#294D3F]">
                Hak akses setelah aktivasi
              </label>
              <select
                id="request-role"
                value={requestRole}
                onChange={(event) => setRequestRole(event.target.value as Role | "")}
                className="w-full rounded-xl border border-[#CBD5CD] bg-white px-3 py-2 text-xs focus:border-[#294D3F] focus:outline-none"
              >
                <option value="" disabled>Pilih hak akses sesuai divisi</option>
                <option value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE.title}</option>
                <option value="HR_ADMIN">{ROLE_LABELS.HR_ADMIN.title}</option>
                <option value="PSYCHOLOGIST">{ROLE_LABELS.PSYCHOLOGIST.title}</option>
                <option value="LEGAL_COUNSEL">{ROLE_LABELS.LEGAL_COUNSEL.title}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#294D3F] mb-1">Alasan Penolakan (wajib saat menolak)</label>
              <textarea
                rows={2}
                maxLength={1000}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white text-xs focus:outline-none focus:border-[#294D3F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading || !requestRole}
                onClick={() => void handleAccountRequestDecision("APPROVED")}
                className="py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow hover:bg-emerald-800 disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Setujui Permohonan"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleAccountRequestDecision("REJECTED")}
                className="py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Tolak Permohonan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

