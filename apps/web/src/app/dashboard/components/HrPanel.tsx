"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  CheckCircle2, Copy, X, XCircle
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ROLE_LABELS, type Role, type WellforaUser } from "@/lib/session";
import PdfDownloadButton from "./PdfDownloadButton";

type Props = {
  user: WellforaUser;
};

type LeaveItem = {
  id: string;
  userId: string;
  type: "CUTI" | "SAKIT" | "DINAS";
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  attachmentUrl?: string | null;
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  hrNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    position?: string | null;
  };
};

type HrSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: Record<string, number>;
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
  reviewedBy: { id: string; name: string } | null;
  createdUser: { id: string; name: string; role: Role } | null;
};

async function fetchLeaves(statusFilter: string) {
  const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
  return Promise.all([
    apiRequest<{ leaves: LeaveItem[] }>(`/leaves${query}`),
    apiRequest<{ summary: HrSummary }>("/leaves/summary")
  ]);
}

export default function HrPanel({ user }: Props) {
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [accountRequests, setAccountRequests] = useState<EmployeeAccountRequest[]>([]);
  const [summary, setSummary] = useState<HrSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedLeave, setSelectedLeave] = useState<LeaveItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [requestDepartment, setRequestDepartment] = useState("");
  const [requestPosition, setRequestPosition] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [activationLinks, setActivationLinks] = useState<Record<string, string>>({});
  const [activationLinkLoading, setActivationLinkLoading] = useState<string | null>(null);

  const loadLeaves = useCallback(async () => {
    try {
      const [lRes, sRes] = await fetchLeaves(statusFilter);
      setLeaves(lRes.leaves);
      setSummary(sRes.summary);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data pengajuan.");
    }
  }, [statusFilter]);

  const loadAccountRequests = useCallback(async () => {
    try {
      const response = await apiRequest<{ requests: EmployeeAccountRequest[] }>("/account-requests");
      setAccountRequests(response.requests);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat permohonan akun.");
    }
  }, []);

  async function showActivationLink(requestId: string) {
    setActivationLinkLoading(requestId);
    setLoadError("");
    try {
      const response = await apiRequest<{ activationUrl: string }>(
        `/account-requests/${requestId}/activation-link`
      );
      setActivationLinks((current) => ({ ...current, [requestId]: response.activationUrl }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal membuat tautan aktivasi.");
    } finally {
      setActivationLinkLoading(null);
    }
  }

  async function copyActivationLink(requestId: string) {
    const activationUrl = activationLinks[requestId];
    if (!activationUrl) return;
    try {
      await navigator.clipboard.writeText(activationUrl);
      setMessage("Tautan aktivasi berhasil disalin. Bagikan hanya kepada karyawan terkait.");
    } catch {
      setLoadError("Tautan tidak dapat disalin otomatis. Salin tautan yang tampil secara manual.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchLeaves(statusFilter)
      .then(([lRes, sRes]) => {
        if (cancelled) return;
        setLeaves(lRes.leaves);
        setSummary(sRes.summary);
        setLoadError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data pengajuan.");
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ requests: EmployeeAccountRequest[] }>("/account-requests")
      .then((response) => {
        if (cancelled) return;
        setAccountRequests(response.requests);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat permohonan akun.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccountRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestSubmitting(true);
    setMessage("");
    try {
      const response = await apiRequest<{ message: string; request: EmployeeAccountRequest }>("/account-requests", {
        method: "POST",
        body: JSON.stringify({
          name: requestName,
          phone: requestPhone,
          department: requestDepartment,
          position: requestPosition,
          ...(requestNotes.trim() ? { notes: requestNotes } : {})
        })
      });
      setMessage(response.message);
      setRequestName("");
      setRequestPhone("");
      setRequestDepartment("");
      setRequestPosition("");
      setRequestNotes("");
      await loadAccountRequests();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal mengirim permohonan akun.");
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleDecision(id: string, newStatus: "APPROVED" | "REJECTED" | "IN_REVIEW") {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiRequest<{ message: string; leave: LeaveItem }>(`/leaves/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          hrNotes: reviewNotes || (newStatus === "APPROVED" ? "Disetujui oleh tim HRD." : "Ditolak setelah ditinjau.")
        })
      });
      setMessage(res.message);
      setSelectedLeave(null);
      setReviewNotes("");
      loadLeaves();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui status");
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
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">PORTAL HR MANAGEMENT & EMPLOYEE CARE</span>
          <h2 className="text-2xl font-extrabold">Dashboard Verifikasi & Kesejahteraan HRD</h2>
          <p className="text-xs text-[#D1DFD5] leading-relaxed">
            Kelola verifikasi surat izin (cuti, sakit, dinas) secara akuntabel, pantau absensi kesehatan, dan tinjau laporan kesejahteraan tim kerja.
          </p>
        </div>
        <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-semibold">
          Petugas HR: <strong>{user.name}</strong>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-[#71857B]">Total Permohonan</div>
          <div className="text-2xl font-extrabold text-[#1E392F] mt-1">{summary?.total ?? 0}</div>
          <div className="text-[11px] text-[#5C7167] mt-0.5">Semua pengajuan izin</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-amber-800">Menunggu Verifikasi</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{summary?.pending ?? 0}</div>
          <div className="text-[11px] text-amber-900 mt-0.5">Perlu approval segera</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-emerald-800">Telah Disetujui</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{summary?.approved ?? 0}</div>
          <div className="text-[11px] text-emerald-900 mt-0.5">Cuti & izin disahkan</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm">
          <div className="text-xs font-bold text-red-800">Ditolak</div>
          <div className="text-2xl font-extrabold text-red-700 mt-1">{summary?.rejected ?? 0}</div>
          <div className="text-[11px] text-red-900 mt-0.5">Tidak memenuhi syarat</div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      <section className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#1E392F]">Permohonan Akun Karyawan Baru</h3>
            <p className="text-xs text-[#5D7369] mt-1">
              Superadmin menetapkan hak akses berdasarkan divisi dan jabatan. Setelah disetujui, HRD membagikan tautan aktivasi agar karyawan membuat password sendiri; HRD tidak dapat melihat atau mengubah password.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAccountRequests()}
            className="shrink-0 px-3 py-2 rounded-xl border border-[#CBD5CD] text-xs font-bold text-[#294D3F] hover:bg-[#F2F6F3]"
          >
            Perbarui status
          </button>
        </div>

        <form onSubmit={handleAccountRequest} className="grid gap-3 sm:grid-cols-2 text-xs">
          <div>
            <label className="block font-bold text-[#294D3F] mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              maxLength={100}
              value={requestName}
              onChange={(event) => setRequestName(event.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
            />
          </div>
          <div>
            <label className="block font-bold text-[#294D3F] mb-1">Nomor Telepon Login</label>
            <input
              type="tel"
              required
              value={requestPhone}
              onChange={(event) => setRequestPhone(event.target.value)}
              placeholder="08xxx atau +62xxx"
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
            />
          </div>
          <div>
            <label className="block font-bold text-[#294D3F] mb-1">Divisi</label>
            <input
              type="text"
              required
              maxLength={100}
              value={requestDepartment}
              onChange={(event) => setRequestDepartment(event.target.value)}
              placeholder="Contoh: HRD"
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
            />
          </div>
          <div>
            <label className="block font-bold text-[#294D3F] mb-1">Jabatan / Posisi</label>
            <input
              type="text"
              required
              maxLength={100}
              value={requestPosition}
              onChange={(event) => setRequestPosition(event.target.value)}
              placeholder="Contoh: Staf HRD"
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold text-[#294D3F] mb-1">Catatan untuk Superadmin (opsional)</label>
            <textarea
              rows={2}
              maxLength={1000}
              value={requestNotes}
              onChange={(event) => setRequestNotes(event.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={requestSubmitting}
              className="px-4 py-2.5 rounded-xl bg-[#294D3F] text-white text-xs font-bold shadow hover:bg-[#1E392F] disabled:opacity-50"
            >
              {requestSubmitting ? "Mengirim Permohonan..." : "Kirim ke Superadmin"}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8ECE6] text-[#71857B] font-bold">
                <th className="py-3 px-3">Calon Karyawan</th>
                <th className="py-3 px-3">Divisi & Jabatan</th>
                <th className="py-3 px-3">Diajukan</th>
                <th className="py-3 px-3">Status & Hasil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4F1]">
              {accountRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#7A8E83]">
                    Belum ada permohonan akun.
                  </td>
                </tr>
              ) : accountRequests.map((request) => (
                <tr key={request.id}>
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#1E392F]">{request.name}</div>
                    <div className="text-[11px] text-[#5C7167]">{request.phone}</div>
                  </td>
                  <td className="py-3 px-3 text-[#556960]">
                    <div>{request.department}</div>
                    <div className="text-[10px] text-[#788E83]">{request.position}</div>
                  </td>
                  <td className="py-3 px-3 text-[#556960]">{new Date(request.createdAt).toLocaleDateString("id-ID")}</td>
                  <td className="py-3 px-3">
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${request.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : request.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                      {request.status === "PENDING" ? "Menunggu Superadmin" : request.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                    </span>
                    {request.createdUser ? (
                      <div className="mt-1 text-[10px] text-[#3D6953]">
                        Akun {request.createdUser.name} aktif dengan akses {ROLE_LABELS[request.createdUser.role].title}.
                      </div>
                    ) : request.status === "APPROVED" ? (
                      <div className="mt-2 space-y-2">
                        <div className="text-[10px] text-[#71857B]">
                          Hak akses: {request.approvedRole ? ROLE_LABELS[request.approvedRole].title : "Karyawan"}. Menunggu aktivasi karyawan.
                        </div>
                        <button
                          type="button"
                          disabled={activationLinkLoading === request.id}
                          onClick={() => void showActivationLink(request.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#EAF0EC] text-[#294D3F] font-bold text-[10px] hover:bg-[#DCE8DF] disabled:opacity-50"
                        >
                          {activationLinkLoading === request.id ? "Menyiapkan..." : "Tampilkan tautan aktivasi"}
                        </button>
                        {activationLinks[request.id] && (
                          <div className="flex items-center gap-1.5">
                            <input
                              aria-label={`Tautan aktivasi untuk ${request.name}`}
                              readOnly
                              value={activationLinks[request.id]}
                              className="min-w-0 w-48 px-2 py-1 rounded border border-[#CBD5CD] text-[10px]"
                            />
                            <button
                              type="button"
                              aria-label="Salin tautan aktivasi"
                              onClick={() => void copyActivationLink(request.id)}
                              className="p-1.5 rounded border border-[#CBD5CD] text-[#294D3F] hover:bg-[#F2F6F3]"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] text-[#71857B]">Tautan berlaku 24 jam dan hanya dapat digunakan sekali.</div>
                      </div>
                    ) : null}
                    {request.rejectionReason && <div className="mt-1 text-[10px] text-red-700">{request.rejectionReason}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Main Approval Queue & Welfare Reports */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1E392F]">Antrean Surat Izin Karyawan</h3>
            <p className="text-xs text-[#5D7369]">Tinjau permohonan izin cuti tahunan, surat dokter izin sakit, dan dinas.</p>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 p-1 bg-[#FBF9F5] border border-[#CBD5CD] rounded-xl text-xs font-bold text-[#556960]">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "ALL" ? "bg-[#294D3F] text-white" : "hover:text-[#294D3F]"}`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "PENDING" ? "bg-amber-600 text-white" : "hover:text-amber-800"}`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter("APPROVED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "APPROVED" ? "bg-emerald-700 text-white" : "hover:text-emerald-800"}`}
            >
              Disetujui
            </button>
            <button
              onClick={() => setStatusFilter("REJECTED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "REJECTED" ? "bg-red-700 text-white" : "hover:text-red-800"}`}
            >
              Ditolak
            </button>
          </div>
        </div>

        {/* Leaves Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E8ECE6] text-[#71857B] font-bold">
                <th className="py-3 px-3">Karyawan</th>
                <th className="py-3 px-3">Jenis Izin</th>
                <th className="py-3 px-3">Periode</th>
                <th className="py-3 px-3">Alasan & Lampiran</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi HRD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4F1]">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7A8E83]">
                    Tidak ada surat izin dalam kategori ini.
                  </td>
                </tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-[#FBF9F5] transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[#1E392F]">{l.user.name}</div>
                      <div className="text-[11px] text-[#5C7167]">{l.user.department || "Operasional"} · {l.user.position || "Karyawan"}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-[#EAF0EC] text-[#294D3F]">
                        {l.type}
                      </span>
                      <span className="text-[11px] font-semibold text-[#556960] block mt-0.5">{l.daysCount} Hari</span>
                    </td>
                    <td className="py-3.5 px-3 text-[#556960]">
                      <div>{new Date(l.startDate).toLocaleDateString("id-ID")}</div>
                      <div className="text-[10px] text-[#788E83]">s/d {new Date(l.endDate).toLocaleDateString("id-ID")}</div>
                    </td>
                    <td className="py-3.5 px-3 max-w-xs">
                      <div className="truncate text-[#1E392F] font-medium">{l.reason}</div>
                      {l.attachmentUrl && (
                        <div className="text-[10px] mt-0.5">
                          {l.attachmentUrl.startsWith("data:image") ? (
                            <a href={l.attachmentUrl} target="_blank" rel="noreferrer">
                              <img src={l.attachmentUrl} alt="Lampiran" className="h-14 rounded-lg border border-[#CBD5CD] object-cover cursor-pointer hover:opacity-80 mt-1" />
                            </a>
                          ) : l.attachmentUrl.startsWith("data:") ? (
                            <a href={l.attachmentUrl} download="lampiran" className="text-blue-700 underline flex items-center gap-1">
                              📎 Unduh Lampiran
                            </a>
                          ) : (
                            <a href={l.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline truncate block">
                              Lampiran: {l.attachmentUrl}
                            </a>
                          )}
                        </div>
                      )}
                      {l.hrNotes && (
                        <div className="text-[10px] text-[#3D6953] bg-emerald-50 p-1 rounded mt-1">
                          Catatan HR: {l.hrNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : l.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {l.status === "APPROVED" && (
                          <PdfDownloadButton
                            path={`/documents/leaves/${encodeURIComponent(l.id)}.pdf`}
                            filename={`surat-izin-${l.id}.pdf`}
                          />
                        )}
                        <button
                          onClick={() => { setSelectedLeave(l); setReviewNotes(l.hrNotes || ""); }}
                          className="px-3 py-1.5 rounded-lg bg-[#EAF0EC] hover:bg-[#294D3F] hover:text-white text-[#294D3F] font-bold text-[11px] transition-all"
                        >
                          Verifikasi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal for HRD */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              onClick={() => setSelectedLeave(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">VERIFIKASI & PERSETUJUAN HRD</span>
              <h3 className="text-xl font-bold text-[#1E392F]">Surat Izin: {selectedLeave.user.name}</h3>
              <p className="text-xs text-[#5D7369] mt-0.5">
                Divisi: {selectedLeave.user.department} · {selectedLeave.user.email}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6] space-y-2 text-xs text-[#294D3F]">
              <div className="flex justify-between">
                <span><strong>Jenis:</strong> {selectedLeave.type}</span>
                <span><strong>Durasi:</strong> {selectedLeave.daysCount} Hari</span>
              </div>
              <div>
                <strong>Periode:</strong> {new Date(selectedLeave.startDate).toLocaleDateString("id-ID")} - {new Date(selectedLeave.endDate).toLocaleDateString("id-ID")}
              </div>
              <div>
                <strong>Alasan Pegawai:</strong> {selectedLeave.reason}
              </div>
              {selectedLeave.attachmentUrl && (
                <div>
                  <strong>Lampiran:</strong>
                  <div className="mt-1">
                    {selectedLeave.attachmentUrl.startsWith("data:image") ? (
                      <a href={selectedLeave.attachmentUrl} target="_blank" rel="noreferrer">
                        <img src={selectedLeave.attachmentUrl} alt="Lampiran" className="max-h-48 rounded-xl border border-[#CBD5CD] object-contain cursor-pointer hover:opacity-80" />
                      </a>
                    ) : selectedLeave.attachmentUrl.startsWith("data:") ? (
                      <a href={selectedLeave.attachmentUrl} download="lampiran" className="text-blue-700 underline flex items-center gap-1 text-xs">
                        📎 Unduh File Lampiran
                      </a>
                    ) : (
                      <a href={selectedLeave.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline text-xs">
                        {selectedLeave.attachmentUrl}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#294D3F] mb-1">Catatan Resmi HRD (Kepada Karyawan)</label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="cth: Disetujui. Sisa jatah cuti tahunan Anda 9 hari. Harap selesaikan delegasi tugas..."
                className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white text-xs focus:outline-none focus:border-[#294D3F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                disabled={loading}
                onClick={() => handleDecision(selectedLeave.id, "APPROVED")}
                className="py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow hover:bg-emerald-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                <span>Setujui Permohonan</span>
              </button>
              <button
                disabled={loading}
                onClick={() => handleDecision(selectedLeave.id, "REJECTED")}
                className="py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <XCircle size={15} />
                <span>Tolak Permohonan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

