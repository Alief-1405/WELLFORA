"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  BookOpen, CheckCircle2, Heart, Plus, Stethoscope, Trash2, X
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { WellforaUser } from "@/lib/session";
import PdfDownloadButton from "./PdfDownloadButton";

type Props = {
  user: WellforaUser;
};

type PracticeSlot = {
  id: string;
  day: string;
  time: string;
  isAvailable: boolean;
};

type Booking = {
  id: string;
  scheduledAt: string;
  notes?: string | null;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  clinicalNotes?: string | null;
  actionPlan?: string | null;
  counselingUrl?: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    position?: string | null;
  };
};

export default function PsychologistPanel({ user }: Props) {
  const [slots, setSlots] = useState<PracticeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<"practice" | "education">("practice");
  const [newDay, setNewDay] = useState("Senin");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:30");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [counselingUrl, setCounselingUrl] = useState("");
  const [newStatus, setNewStatus] = useState<Booking["status"]>("CONFIRMED");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [sRes, bRes] = await Promise.all([
        apiRequest<{ slots: PracticeSlot[] }>("/counseling/slots"),
        apiRequest<{ bookings: Booking[] }>("/counseling/bookings")
      ]);
      setSlots(sRes.slots);
      setBookings(bRes.bookings);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data konseling.");
    }
  }

  async function addSlot(e: FormEvent) {
    e.preventDefault();
    if (newEndTime <= newStartTime) {
      alert("Waktu selesai harus setelah waktu mulai.");
      return;
    }

    try {
      const res = await apiRequest<{ slot: PracticeSlot; message: string }>("/counseling/slots", {
        method: "POST",
        body: JSON.stringify({
          day: newDay,
          time: `${newStartTime} - ${newEndTime} WIB`
        })
      });
      setSlots([...slots, res.slot]);
      setMessage("Slot praktik baru berhasil disimpan.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menambahkan slot");
    }
  }

  async function deleteSlot(id: string) {
    try {
      await apiRequest(`/counseling/slots/${id}`, { method: "DELETE" });
      setSlots(slots.filter((s) => s.id !== id));
      setMessage("Slot praktik dihapus.");
    } catch {
      alert("Gagal menghapus slot.");
    }
  }

  async function updateBooking() {
    if (!selectedBooking) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ booking: Booking; message: string }>(
        `/counseling/bookings/${selectedBooking.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: newStatus,
            clinicalNotes: clinicalNotes || undefined,
            actionPlan: actionPlan || undefined,
            counselingUrl: counselingUrl || undefined
          })
        }
      );
      setMessage(res.message);
      setSelectedBooking(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal update status");
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
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">KLINIK KESEJAHTERAAN & KESEHATAN MENTAL</span>
          <h2 className="text-2xl font-extrabold">Portal Praktik & Rekam Medis Psikologis</h2>
          <p className="text-xs text-[#D1DFD5] leading-relaxed">
            Kelola slot ketersediaan konsultasi, konfirmasi janji temu karyawan, dan dokumentasikan catatan medis serta rencana intervensi klinis.
          </p>
        </div>
        <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-semibold">
          Psikolog Bertugas: <strong>{user.name}</strong>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E8ECE6] pb-3">
        <button
          onClick={() => setActiveTab("practice")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeTab === "practice" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
        >
          <Stethoscope size={14} /> Jadwal Praktik & Konsultasi
        </button>
        <button
          onClick={() => setActiveTab("education")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activeTab === "education" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
        >
          <BookOpen size={14} /> Edukasi Kesehatan Mental
        </button>
      </div>

      {activeTab === "practice" && (<>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {/* Grid: Slots Manager (Left) & Bookings Approval (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Practice Slots Manager */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-4">
          <div>
            <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">JADWAL PRAKTIK</span>
            <h3 className="text-lg font-bold text-[#1E392F]">Slot Waktu Praktik Saya</h3>
            <p className="text-xs text-[#5D7369]">Tentukan hari dan jam konsultasi yang terbuka untuk karyawan.</p>
          </div>

          <form onSubmit={addSlot} className="space-y-3 p-3.5 rounded-xl bg-[#FBF9F5] border border-[#CBD5CD] text-xs">
            <div className="font-bold text-[#294D3F]">Tambah Slot Praktik Baru:</div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5C7167] mb-1">Hari Praktik</label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5CD] bg-white focus:outline-none"
              >
                {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#5C7167] mb-1">Mulai</label>
                <input
                  type="time"
                  required
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5C7167] mb-1">Selesai</label>
                <input
                  type="time"
                  required
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#294D3F] text-white font-bold text-xs hover:bg-[#1E392F] transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>Simpan Slot Praktik</span>
            </button>
          </form>

          {/* Slots List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#294D3F]">Daftar Slot Aktif:</div>
            {slots.length === 0 ? (
              <div className="text-xs text-[#7A8E83] p-4 text-center border border-dashed rounded-xl">
                Belum ada slot waktu terdaftar.
              </div>
            ) : (
              slots.map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E2DBD1] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#1E392F]">{s.day}</span>
                    <span className="text-[#5C7167] block text-[11px]">{s.time}</span>
                  </div>
                  <button
                    onClick={() => deleteSlot(s.id)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    title="Hapus Slot"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bookings Approval & Medical Notes */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-4">
          <div>
            <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">JANJI TEMU & REKAM MEDIS</span>
            <h3 className="text-lg font-bold text-[#1E392F]">Daftar Konsultasi Karyawan Masuk</h3>
            <p className="text-xs text-[#5D7369]">Tinjau permohonan konseling, konfirmasi sesi, dan isi catatan klinis.</p>
          </div>

          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7A8E83] border border-dashed rounded-xl">
                Belum ada jadwal konsultasi yang masuk.
              </div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="p-4 rounded-xl border border-[#E8ECE6] bg-[#FBF9F5] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-[#1E392F]">{b.employee.name}</div>
                      <div className="text-[11px] text-[#5C7167]">{b.employee.department} · {b.employee.email}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : b.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                      {b.status}
                    </span>
                  </div>

                  <div className="text-[#5C7167]">
                    <div><strong>Waktu Sesi:</strong> {new Date(b.scheduledAt).toLocaleString("id-ID")}</div>
                    {b.notes && <div className="mt-1"><strong>Keluhan Awal:</strong> {b.notes}</div>}
                    {b.counselingUrl && (
                      <div className="mt-1">
                        <strong>Ruang Telehealth:</strong> <a href={b.counselingUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">{b.counselingUrl}</a>
                      </div>
                    )}
                  </div>

                  {b.clinicalNotes && (
                    <div className="p-3 rounded-xl bg-white border border-[#CBD5CD] space-y-1 text-[#294D3F]">
                      <div className="font-bold text-[#3D6953]">Catatan Klinis yang Telah Diinput:</div>
                      <p className="text-[11px]">{b.clinicalNotes}</p>
                      {b.actionPlan && (
                        <div className="text-[11px] mt-1 pt-1 border-t border-[#F0F4F1]">
                          <strong>Rekomendasi Tindak Lanjut:</strong> {b.actionPlan}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#EAEFEA] flex justify-between items-center gap-2">
                    {(b.status === "CONFIRMED" || b.status === "COMPLETED") && (
                      <PdfDownloadButton
                        path={`/documents/bookings/${encodeURIComponent(b.id)}.pdf`}
                        filename={`konseling-${b.id}.pdf`}
                      />
                    )}
                    <button
                      onClick={() => {
                        setSelectedBooking(b);
                        setNewStatus(b.status === "PENDING" ? "CONFIRMED" : b.status);
                        setClinicalNotes(b.clinicalNotes || "");
                        setActionPlan(b.actionPlan || "");
                        setCounselingUrl(b.counselingUrl || "");
                      }}
                      className="px-4 py-2 rounded-xl bg-[#294D3F] hover:bg-[#1E392F] text-white font-bold text-xs shadow transition-all"
                    >
                      Kelola Sesi & Input Catatan Medis
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Input Catatan Sesi Medis */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E2DBD1] space-y-5">
            <button
              onClick={() => setSelectedBooking(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F2F6F3] text-[#556960] hover:bg-[#E2ECE5] flex items-center justify-center"
            >
              <X size={16} />
            </button>

            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">REKAM MEDIS & EVALUASI KLINIS</span>
              <h3 className="text-xl font-bold text-[#1E392F]">Sesi: {selectedBooking.employee.name}</h3>
              <p className="text-xs text-[#5D7369]">Jadwal: {new Date(selectedBooking.scheduledAt).toLocaleString("id-ID")}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Status Sesi Konseling</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Booking["status"])}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                >
                  <option value="CONFIRMED">Dikonfirmasi (Siap Sesi)</option>
                  <option value="IN_PROGRESS">Sesi Sedang Berlangsung</option>
                  <option value="COMPLETED">Selesai (Catatan Klinis Selesai)</option>
                  <option value="CANCELLED">Dibatalkan</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Tautan Ruang Sesi Telehealth (Google Meet/WellMeet)</label>
                <input
                  type="text"
                  value={counselingUrl}
                  onChange={(e) => setCounselingUrl(e.target.value)}
                  placeholder="https://tautan-sesi-aman..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Catatan Medis / Diagnostik Psikologis</label>
                <textarea
                  rows={4}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Observasi klinis, tingkat kecemasan/stres yang diamati, dinamika psikologis..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Rencana Tindak Lanjut (Action Plan)</label>
                <textarea
                  rows={3}
                  value={actionPlan}
                  onChange={(e) => setActionPlan(e.target.value)}
                  placeholder="Latihan relaksasi harian, pembatasan beban kerja, follow-up dalam 2 minggu..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={updateBooking}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold text-xs shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Pembaruan & Catatan Medis"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* TAB: EDUKASI KESEHATAN MENTAL */}
      {activeTab === "education" && (
        <div className="space-y-5">
          {/* Hero */}
          <div className="bg-[#315746] text-white rounded-3xl p-6 sm:p-8 shadow-sm">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">MENTAL HEALTH EDUCATION — REFERENSI PSIKOLOG</span>
            <h2 className="text-2xl font-extrabold mt-1">Edukasi Kesehatan Mental Pekerja</h2>
            <p className="text-xs text-[#D1DFD5] mt-2 leading-relaxed max-w-2xl">
              Referensi edukasi untuk mendampingi pemahaman klien seputar kesehatan mental di lingkungan kerja — dari pengenalan kondisi umum hingga strategi pemulihan.
            </p>
          </div>

          {/* Pengantar */}
          <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
            <div className="bg-[#294D3F] px-5 py-3 flex items-center gap-2">
              <Heart size={15} className="text-[#C6D9CD]" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Fondasi Kesehatan Mental</h4>
            </div>
            <div className="p-5 text-xs text-[#3D5247] leading-relaxed space-y-2">
              <p>Kesehatan mental adalah fondasi kesejahteraan emosional, psikologis, dan sosial seseorang. Ia menentukan cara individu berpikir, merasakan, mengambil keputusan, serta menghadapi tekanan hidup.</p>
              <p>Dunia kerja sering menghadirkan tantangan yang memicu berbagai masalah psikologis. Pemahaman yang baik tentang kondisi-kondisi ini membantu psikolog memberikan pendampingan yang tepat sasaran.</p>
            </div>
          </div>

          {/* 3 Kondisi Umum */}
          <div>
            <h3 className="text-sm font-extrabold text-[#1E392F] mb-3">Kondisi Psikologis Umum di Lingkungan Kerja</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  emoji: "😓", title: "Stres Kerja",
                  color: "border-amber-200 bg-amber-50", titleColor: "text-amber-900",
                  desc: "Muncul ketika tuntutan melebihi kapasitas — beban berlebih atau tenggat ketat. Intervensi: manajemen waktu, komunikasi terbuka, dan restrukturisasi beban kerja.",
                  tag: "Dapat Dikelola Mandiri"
                },
                {
                  emoji: "🔥", title: "Burnout",
                  color: "border-red-200 bg-red-50", titleColor: "text-red-900",
                  desc: "Kelelahan berkepanjangan disertai sikap negatif dan penurunan produktivitas. Memerlukan pemulihan sistematis, jeda bermakna, dan rebalancing kehidupan.",
                  tag: "Perlu Intervensi Profesional"
                },
                {
                  emoji: "😰", title: "Kecemasan Karier",
                  color: "border-purple-200 bg-purple-50", titleColor: "text-purple-900",
                  desc: "Ketidakpastian karier memicu kecemasan yang jika berlangsung terus-menerus dan mengganggu fungsi keseharian, perlu penanganan klinis terstruktur.",
                  tag: "Konsultasi Psikolog"
                },
              ].map((card, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${card.color} space-y-2 text-xs`}>
                  <div className="text-2xl">{card.emoji}</div>
                  <div className={`font-extrabold text-sm ${card.titleColor}`}>{card.title}</div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 text-[#294D3F]">{card.tag}</span>
                  <p className="leading-relaxed text-[#3D4A43]">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strategi Pemulihan */}
          <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
            <div className="bg-emerald-700 px-5 py-3 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-200" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Strategi Menjaga Kesejahteraan Emosional</h4>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#3D5247]">
              {[
                { icon: "🧘", title: "Regulasi Emosi", desc: "Kenali sumber tekanan dan respons secara sehat — jeda atau latihan pernapasan, bukan menekan perasaan." },
                { icon: "🌿", title: "Self-Care Terstruktur", desc: "Tidur cukup, nutrisi baik, hobi, dan istirahat adalah fondasi energi — bukan kemalasan." },
                { icon: "⚖️", title: "Work-Life Balance", desc: "Pembagian waktu dan energi yang adil antara karier dan kehidupan pribadi mencegah kelelahan kronis." },
                { icon: "🤝", title: "Lingkungan Psikologis Aman", desc: "Hubungan kerja yang suportif, terbuka, bebas intimidasi dan diskriminasi menciptakan rasa aman psikologis." },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#F8FAF9] border border-[#E8ECE6]">
                  <span className="text-xl shrink-0">{tip.icon}</span>
                  <div>
                    <div className="font-bold text-[#1E392F] mb-0.5">{tip.title}</div>
                    <p className="leading-relaxed text-[#5C7167]">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hapus Stigma */}
          <div className="bg-[#EAF0EC] border border-[#C6D9CD] rounded-2xl p-5 flex items-start gap-4">
            <span className="text-3xl shrink-0">💬</span>
            <div className="text-xs text-[#294D3F]">
              <div className="font-extrabold text-sm mb-1">Peran Psikolog dalam Menghapus Stigma</div>
              <p className="leading-relaxed">
                Masyarakat perlu bersama-sama menghilangkan stigma bahwa masalah mental adalah kelemahan. Setiap individu berhak mendapatkan pemahaman, penghargaan atas pengalamannya, serta dukungan penuh tanpa dihakimi. Psikolog memegang peran kunci dalam membangun budaya kesehatan mental yang sehat di tempat kerja.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
