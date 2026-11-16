"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertOctagon, BookOpen, CheckCircle2, FileText,
  Gavel, Lock, Scale, ShieldAlert,
  ShieldCheck, UserCheck, X
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { WellforaUser } from "@/lib/session";
import PdfDownloadButton from "./PdfDownloadButton";

type Props = {
  user: WellforaUser;
};

type Complaint = {
  id: string;
  ticketNumber: string;
  userId?: string;
  counselId?: string | null;
  category: "PELECEHAN_SEKSUAL" | "KEKERASAN_INTIMIDASI" | "PELANGGARAN_HUKUM_KERJA" | "DISKRIMINASI" | "LAINNYA";
  title: string;
  description: string;
  incidentDate: string;
  location?: string | null;
  isAnonymous: boolean;
  evidenceInfo?: string | null;
  status: "SUBMITTED" | "IN_REVIEW" | "INVESTIGATION" | "MEDIATION" | "RESOLVED" | "CLOSED";
  legalNotes?: string | null;
  investigationNotes?: string | null;
  mediationNotes?: string | null;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    position?: string | null;
  };
  counsel?: {
    id: string;
    name: string;
  } | null;
};

type LegalSummary = {
  total: number;
  submitted: number;
  inReview: number;
  investigation: number;
  mediation: number;
  resolved: number;
  byCategory: Record<string, number>;
};

async function fetchComplaints(statusFilter: string) {
  const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
  return Promise.all([
    apiRequest<{ complaints: Complaint[] }>(`/legal/complaints${query}`),
    apiRequest<{ summary: LegalSummary }>("/legal/summary")
  ]);
}

export default function LegalPanel({ user }: Props) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [summary, setSummary] = useState<LegalSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"cases" | "knowledge">("cases");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedCase, setSelectedCase] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<Complaint["status"]>("INVESTIGATION");
  const [legalNotes, setLegalNotes] = useState("");
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [mediationNotes, setMediationNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadComplaints = useCallback(async () => {
    try {
      const [cRes, sRes] = await fetchComplaints(statusFilter);
      setComplaints(cRes.complaints);
      setSummary(sRes.summary);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data pengaduan.");
    }
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    fetchComplaints(statusFilter)
      .then(([cRes, sRes]) => {
        if (cancelled) return;
        setComplaints(cRes.complaints);
        setSummary(sRes.summary);
        setLoadError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data pengaduan.");
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  async function handleUpdateCase() {
    if (!selectedCase) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ complaint: Complaint; message: string }>(
        `/legal/complaints/${selectedCase.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: newStatus,
            legalNotes: legalNotes || undefined,
            investigationNotes: investigationNotes || undefined,
            mediationNotes: mediationNotes || undefined
          })
        }
      );
      setMessage(res.message);
      setSelectedCase(null);
      loadComplaints();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui status kasus");
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
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">DIVISI ADVOKAT & KEPATUHAN HUKUM</span>
          <h2 className="text-2xl font-extrabold">Dashboard Pengaduan & Perlindungan Pekerja</h2>
          <p className="text-xs text-[#D1DFD5] leading-relaxed">
            Terima dan tindak lanjuti laporan pelecehan seksual, intimidasi/kekerasan, serta pelanggaran ketenagakerjaan dengan jaminan Whistleblower Protection.
          </p>
        </div>
        <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-semibold">
          Advokat Legal: <strong>{user.name}</strong>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E8ECE6] pb-3">
        <button
          onClick={() => setActiveTab("cases")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeTab === "cases" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
        >
          <Scale size={14} /> Berkas Pengaduan
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeTab === "knowledge" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
        >
          <BookOpen size={14} /> Pusat Pengetahuan Hukum
        </button>
      </div>

      {/* Metrics */}
      {activeTab === "cases" && (<>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-[#E8ECE6] shadow-sm">
          <div className="text-[11px] font-bold text-[#71857B]">Total Laporan</div>
          <div className="text-2xl font-extrabold text-[#1E392F] mt-1">{summary?.total ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E8ECE6] shadow-sm">
          <div className="text-[11px] font-bold text-amber-800">Laporan Masuk</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{summary?.submitted ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E8ECE6] shadow-sm">
          <div className="text-[11px] font-bold text-blue-800">Investigasi</div>
          <div className="text-2xl font-extrabold text-blue-700 mt-1">{summary?.investigation ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E8ECE6] shadow-sm">
          <div className="text-[11px] font-bold text-purple-800">Mediasi</div>
          <div className="text-2xl font-extrabold text-purple-700 mt-1">{summary?.mediation ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E8ECE6] shadow-sm">
          <div className="text-[11px] font-bold text-emerald-800">Selesai</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{summary?.resolved ?? 0}</div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {/* Complaints List & Case Investigation */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1E392F]">Berkas Pengaduan Hukum</h3>
            <p className="text-xs text-[#5D7369]">Pemeriksaan alat bukti, wawancara saksi, dan penegakan keadilan pekerja.</p>
          </div>

          {/* Filter Status */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FBF9F5] border border-[#CBD5CD] rounded-xl text-xs font-bold text-[#556960]">
            {["ALL", "SUBMITTED", "IN_REVIEW", "INVESTIGATION", "MEDIATION", "RESOLVED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === st ? "bg-[#294D3F] text-white" : "hover:text-[#294D3F]"}`}
              >
                {st === "ALL" ? "Semua" : st}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {complaints.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7A8E83] border border-dashed rounded-xl">
              Tidak ada laporan kasus hukum dalam kategori ini.
            </div>
          ) : (
            complaints.map((c) => (
              <div key={c.id} className="p-5 rounded-2xl border border-[#E8ECE6] bg-[#FBF9F5] space-y-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EAF0EC] text-[#294D3F]">
                      {c.ticketNumber}
                    </span>
                    <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                      {c.category.replace(/_/g, " ")}
                    </span>
                    {c.isAnonymous && (
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 flex items-center gap-1">
                        <Lock size={11} /> Whistleblower Anonim
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                    Status: {c.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#1E392F]">{c.title}</h4>
                  <div className="text-[11px] text-[#71857B] mt-0.5">
                    Pelapor: <strong>{c.employee.name}</strong> ({c.employee.department}) · Tanggal Kejadian: {new Date(c.incidentDate).toLocaleDateString("id-ID")}
                    {c.location && ` · Lokasi: ${c.location}`}
                  </div>
                  <p className="text-xs text-[#5C7167] mt-2 bg-white p-3 rounded-xl border border-[#E8ECE6] leading-relaxed">
                    {c.description}
                  </p>
                </div>

                {c.evidenceInfo && (
                  <div className="text-[11px] text-[#556960] bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                    <strong>Bukti Awal / Saksi:</strong> {c.evidenceInfo}
                  </div>
                )}

                {/* Status Notes from Legal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {c.legalNotes && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#CBD5CD] text-[11px]">
                      <span className="font-bold text-purple-900 block">Telaah Hukum:</span>
                      <p className="text-[#556960] mt-0.5">{c.legalNotes}</p>
                    </div>
                  )}
                  {c.investigationNotes && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#CBD5CD] text-[11px]">
                      <span className="font-bold text-blue-900 block">Investigasi Fakta:</span>
                      <p className="text-[#556960] mt-0.5">{c.investigationNotes}</p>
                    </div>
                  )}
                  {c.mediationNotes && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#CBD5CD] text-[11px]">
                      <span className="font-bold text-emerald-900 block">Hasil Mediasi / Sanksi:</span>
                      <p className="text-[#556960] mt-0.5">{c.mediationNotes}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#EAEFEA] flex justify-between items-center gap-2">
                  {(c.status === "RESOLVED" || c.status === "CLOSED") && (
                    <PdfDownloadButton
                      path={`/documents/complaints/${encodeURIComponent(c.id)}.pdf`}
                      filename={`berkas-hukum-${c.ticketNumber}.pdf`}
                    />
                  )}
                  <button
                    onClick={() => {
                      setSelectedCase(c);
                      setNewStatus(c.status);
                      setLegalNotes(c.legalNotes || "");
                      setInvestigationNotes(c.investigationNotes || "");
                      setMediationNotes(c.mediationNotes || "");
                    }}
                    className="px-4 py-2 rounded-xl bg-[#294D3F] hover:bg-[#1E392F] text-white font-bold text-xs shadow transition-all flex items-center gap-1.5"
                  >
                    <Scale size={14} />
                    <span>Tindak Lanjuti Perkara</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Tindak Lanjut Perkara Hukum */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              onClick={() => setSelectedCase(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">BERITA ACARA & INVESTIGASI HUKUM</span>
              <h3 className="text-xl font-bold text-[#1E392F]">Tiket: {selectedCase.ticketNumber}</h3>
              <p className="text-xs text-[#5D7369]">{selectedCase.title}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Tahapan Status Penanganan Perkara</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Complaint["status"])}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                >
                  <option value="SUBMITTED">1. Laporan Masuk (Submitted)</option>
                  <option value="IN_REVIEW">2. Verifikasi Dokumen & Bukti (In Review)</option>
                  <option value="INVESTIGATION">3. Investigasi Fakta & Saksi (Investigation)</option>
                  <option value="MEDIATION">4. Proses Mediasi / Sidang Kepatuhan (Mediation)</option>
                  <option value="RESOLVED">5. Kasus Terselesaikan & Sanksi Ditegakkan (Resolved)</option>
                  <option value="CLOSED">6. Ditutup (Closed)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Telaah Hukum & Pelanggaran Regulasi</label>
                <textarea
                  rows={2}
                  value={legalNotes}
                  onChange={(e) => setLegalNotes(e.target.value)}
                  placeholder="Kualifikasi hukum (misal: pasal 78 UU Cipta Kerja / UU TPKS / Kode Etik Wellfora)..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Catatan Investigasi Lapangan & Bukti Saksi</label>
                <textarea
                  rows={3}
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  placeholder="Hasil klarifikasi pihak terkait, keterangan saksi, dan keabsahan bukti..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Berita Acara Mediasi & Rekomendasi Sanksi</label>
                <textarea
                  rows={3}
                  value={mediationNotes}
                  onChange={(e) => setMediationNotes(e.target.value)}
                  placeholder="Kesepakatan mediasi, surat peringatan (SP), kompensasi kerugian, atau eskalasi ke kepolisian..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleUpdateCase}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold text-xs shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {loading ? "Menyimpan Berkas..." : "Simpan Berita Acara & Perbarui Status"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* TAB: PUSAT PENGETAHUAN HUKUM */}
      {activeTab === "knowledge" && (
        <div className="space-y-5">
          {/* About */}
          <div className="bg-[#EAF0EC] border border-[#C6D9CD] rounded-2xl p-5 space-y-1">
            <div className="flex items-center gap-2 text-[#294D3F]">
              <BookOpen size={18} />
              <h3 className="font-extrabold text-sm">Legal Knowledge Center — Wellfora</h3>
            </div>
            <p className="text-xs text-[#4A6B5D] leading-relaxed">
              Bagian dari Wellfora yang menyediakan informasi dan edukasi hukum ketenagakerjaan secara sederhana, praktis, dan mudah dipahami. Kami menghadirkan berbagai materi untuk membantu pekerja memahami hak, kewajiban, serta perlindungan hukum dalam lingkungan kerja.
            </p>
          </div>

          {/* Artikel 1: Hukum Ketenagakerjaan */}
          <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
            <div className="bg-[#294D3F] px-5 py-3 flex items-center gap-2">
              <Gavel size={16} className="text-[#C6D9CD]" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Mengenal Hukum Ketenagakerjaan</h4>
            </div>
            <div className="p-5 text-xs text-[#3D5247] leading-relaxed">
              Hukum ketenagakerjaan merupakan aturan yang mengatur hubungan antara pekerja, perusahaan, dan pemerintah — mulai dari sebelum bekerja, selama bekerja, hingga berakhirnya hubungan kerja. Tujuannya adalah menciptakan hubungan industrial yang adil dan seimbang.
            </div>
          </div>

          {/* Artikel 2: Hak & Kewajiban */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hak Pekerja */}
            <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
              <div className="bg-emerald-700 px-5 py-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-200" />
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Hak Pekerja</h4>
              </div>
              <ul className="p-5 space-y-2 text-xs text-[#3D5247]">
                {[
                  "Memperoleh upah sesuai ketentuan yang berlaku.",
                  "Mendapatkan waktu istirahat, istirahat mingguan, dan cuti.",
                  "Memperoleh jaminan sosial ketenagakerjaan dan kesehatan.",
                  "Mendapatkan perlindungan keselamatan dan kesehatan kerja (K3).",
                  "Memperoleh perlakuan yang adil tanpa diskriminasi.",
                  "Membentuk atau menjadi anggota serikat pekerja.",
                  "Mendapatkan perlindungan hukum ketika terjadi pelanggaran hak.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kewajiban Pekerja */}
            <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
              <div className="bg-blue-700 px-5 py-3 flex items-center gap-2">
                <UserCheck size={16} className="text-blue-200" />
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Kewajiban Pekerja</h4>
              </div>
              <ul className="p-5 space-y-2 text-xs text-[#3D5247]">
                {[
                  "Melaksanakan pekerjaan sesuai jabatan dan perjanjian kerja.",
                  "Mematuhi peraturan perusahaan yang berlaku.",
                  "Bekerja secara disiplin, bertanggung jawab, dan profesional.",
                  "Mengikuti prosedur keselamatan dan kesehatan kerja.",
                  "Menjaga kerahasiaan informasi perusahaan.",
                  "Menghormati rekan kerja dan menjaga hubungan profesional.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-blue-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Kewajiban Perusahaan */}
          <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
            <div className="bg-purple-700 px-5 py-3 flex items-center gap-2">
              <ShieldAlert size={16} className="text-purple-200" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Hak & Kewajiban Perusahaan</h4>
            </div>
            <div className="p-5 space-y-3 text-xs text-[#3D5247]">
              <p className="leading-relaxed">Perusahaan memiliki hak untuk mengelola kegiatan operasional, memberikan instruksi dan pembagian tugas, menetapkan standar kinerja, melakukan evaluasi, serta menegakkan disiplin sesuai ketentuan hukum.</p>
              <div className="font-bold text-[#294D3F]">Kewajiban Perusahaan:</div>
              <ul className="space-y-2">
                {[
                  "Membayar upah sesuai ketentuan dan waktu yang diperjanjikan.",
                  "Memenuhi hak pekerja berdasarkan perjanjian kerja dan peraturan perundang-undangan.",
                  "Menjamin keselamatan dan kesehatan kerja.",
                  "Memberikan perlakuan yang adil dan tidak diskriminatif.",
                  "Memenuhi kewajiban jaminan sosial pekerja.",
                  "Memberikan informasi dan dokumen terkait hubungan kerja.",
                  "Menghormati hak pekerja untuk berserikat.",
                  "Melaksanakan prosedur PHK sesuai ketentuan hukum.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-purple-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Topik-topik penting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: <FileText size={15} />, color: "bg-amber-50 border-amber-200 text-amber-900", title: "Perjanjian Kerja & Upah", desc: "Perjanjian kerja memuat hak, kewajiban, serta syarat kerja. Pahami ketentuan upah dan lembur sebelum menandatangani kontrak." },
              { icon: <AlertOctagon size={15} />, color: "bg-red-50 border-red-200 text-red-900", title: "PHK & Hak Pesangon", desc: "Pemutusan Hubungan Kerja (PHK) wajib mengikuti prosedur hukum dengan tetap memperhatikan hak pekerja seperti pesangon atau kompensasi." },
              { icon: <ShieldCheck size={15} />, color: "bg-emerald-50 border-emerald-200 text-emerald-900", title: "K3 & Perlindungan Kerja", desc: "Setiap pekerja berhak atas lingkungan kerja aman, bebas pelecehan dan diskriminasi, serta perlindungan Keselamatan dan Kesehatan Kerja (K3)." },
              { icon: <Gavel size={15} />, color: "bg-blue-50 border-blue-200 text-blue-900", title: "Perselisihan & BPJS", desc: "Penyelesaian perselisihan melalui perundingan bipartit, mediasi, hingga Pengadilan Hubungan Industrial. Pekerja berhak atas BPJS Ketenagakerjaan." },
            ].map((card, i) => (
              <div key={i} className={`rounded-2xl border p-4 ${card.color} space-y-1.5 text-xs`}>
                <div className="flex items-center gap-2 font-extrabold">{card.icon}{card.title}</div>
                <p className="leading-relaxed opacity-90">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="p-4 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6] text-[11px] text-[#5D7369] text-center">
            Pekerja dapat mengakses bantuan hukum termasuk melalui <strong>Wellfora</strong> ketika menghadapi permasalahan atau pelanggaran hak di tempat kerja.
          </div>
        </div>
      )}
    </div>
  );
}
