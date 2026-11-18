"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity, ArrowRight, BookOpen, CalendarDays, Check,
  CheckCircle2, Clock3, FileText, Heart, MessageCircle, Scale,
  Send, ShieldAlert, ShieldCheck, Sparkles, UserCheck
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { WellforaUser } from "@/lib/session";
import PdfDownloadButton from "./PdfDownloadButton";

type Props = {
  user: WellforaUser;
  initialTab?: string;
};

type LeaveRequest = {
  id: string;
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
};

type Psychologist = {
  id: string;
  name: string;
  department?: string | null;
  position?: string | null;
  practiceSlots?: Array<{ id: string; day: string; time: string; isAvailable: boolean }>;
};

type AvailablePracticeSlot = {
  id: string;
  day: string;
  time: string;
  startTime: string;
  booked: boolean;
  past: boolean;
  available: boolean;
};

type Booking = {
  id: string;
  scheduledAt: string;
  notes?: string | null;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  clinicalNotes?: string | null;
  actionPlan?: string | null;
  counselingUrl?: string | null;
  psychologist: { id: string; name: string };
};

type Complaint = {
  id: string;
  ticketNumber: string;
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
};

type LegalStaff = {
  id: string;
  name: string;
  department?: string | null;
};

type ChatMessage = {
  role: "user" | "atma";
  text: string;
  category?: string;
  riskLevel?: string;
  escalation?: {
    badge?: string;
    type: "BOOK_PSYCHOLOGIST" | "LEGAL_COMPLAINT";
    title: string;
    description: string;
    actionText: string;
    actionTab: "counseling" | "complaints";
  } | null;
};

export default function EmployeePanel({ user, initialTab = "overview" }: Props) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab ? (tab === "wellbot" ? "atma" : tab) : initialTab;
  });

  // Leaves state
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState<"CUTI" | "SAKIT" | "DINAS">("CUTI");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveAttachment, setLeaveAttachment] = useState<string>("");
  const [leaveAttachmentName, setLeaveAttachmentName] = useState<string>("");
  const [leaveMsg, setLeaveMsg] = useState("");
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Psychologists & Bookings state
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [counselingSubTab, setCounselingSubTab] = useState<"booking" | "education">("booking");
  const [selectedPsychId, setSelectedPsychId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [selectedBookingTime, setSelectedBookingTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailablePracticeSlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingMsg, setBookingMsg] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  // Complaints state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [legalStaff, setLegalStaff] = useState<LegalStaff[]>([]);
  const [complaintsSubTab, setComplaintsSubTab] = useState<"form" | "knowledge">("form");
  const [compCategory, setCompCategory] = useState<Complaint["category"]>("PELANGGARAN_HUKUM_KERJA");
  const [compCounselId, setCompCounselId] = useState("");
  const [compTitle, setCompTitle] = useState("");
  const [compDesc, setCompDesc] = useState("");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compAnonymous, setCompAnonymous] = useState(false);
  const [compEvidence, setCompEvidence] = useState("");
  const [compMsg, setCompMsg] = useState("");
  const [compLoading, setCompLoading] = useState(false);

  // ATMA Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "atma",
      text: `Halo ${user.name.split(" ")[0]}! 🌿 Aku ATMA — Asisten Teman Mental Anda di Wellfora. Bagaimana perasaanmu hari ini? Kamu bebas bercerita apa pun—aku di sini untuk mendengarkan tanpa menghakimi. Jika kamu merasa lelah, stres, atau menghadapi situasi yang tidak nyaman di tempat kerja, aku siap membantumu menemukan langkah selanjutnya.`
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  // Mood Tracker state
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [moodNote, setMoodNote] = useState("");
  const [moodSaved, setMoodSaved] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest<{ leaves: LeaveRequest[] }>("/leaves"),
      apiRequest<{ psychologists: Psychologist[] }>("/counseling/psychologists"),
      apiRequest<{ bookings: Booking[] }>("/counseling/bookings"),
      apiRequest<{ complaints: Complaint[] }>("/legal/complaints"),
      apiRequest<{ legalStaff: LegalStaff[] }>("/legal/staff")
    ])
      .then(([lRes, pRes, bRes, cRes, legalRes]) => {
        if (cancelled) return;
        setLeaves(lRes.leaves);
        setPsychologists(pRes.psychologists);
        setBookings(bRes.bookings);
        setComplaints(cRes.complaints);
        setLegalStaff(legalRes.legalStaff);
        setLoadError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data karyawan.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPsychId || !bookingDate) return;

    let cancelled = false;
    const query = new URLSearchParams({
      psychologistId: selectedPsychId,
      date: bookingDate
    });
    apiRequest<{ slots: AvailablePracticeSlot[] }>(`/counseling/availability?${query}`)
      .then((response) => {
        if (cancelled) return;
        setAvailableSlots(response.slots);
        setSelectedBookingTime((current) => (
          response.slots.some((slot) => slot.startTime === current && slot.available) ? current : ""
        ));
        setAvailabilityError("");
        setAvailabilityLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailabilityError(err instanceof Error ? err.message : "Gagal memuat ketersediaan jadwal.");
        setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPsychId, bookingDate, availabilityRefresh]);

  const selectedPsychologist = psychologists.find((psychologist) => psychologist.id === selectedPsychId);
  const weeklyPracticeSlots = selectedPsychologist?.practiceSlots?.filter((slot) => slot.isAvailable) ?? [];
  const minimumBookingDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  // Handle Leave Submission
  async function submitLeave(e: FormEvent) {
    e.preventDefault();
    setLeaveLoading(true);
    setLeaveMsg("");
    try {
      const res = await apiRequest<{ message: string; leave: LeaveRequest }>("/leaves", {
        method: "POST",
        body: JSON.stringify({
          type: leaveType,
          startDate: new Date(leaveStart).toISOString(),
          endDate: new Date(leaveEnd).toISOString(),
          reason: leaveReason,
          attachmentUrl: leaveAttachment || undefined
        })
      });
      setLeaveMsg(res.message);
      setLeaves([res.leave, ...leaves]);
      setLeaveReason("");
      setLeaveAttachment("");
      setLeaveAttachmentName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengajukan izin");
    } finally {
      setLeaveLoading(false);
    }
  }

  function handleAttachmentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 3.5MB
    if (file.size > 3.5 * 1024 * 1024) {
      alert("Ukuran file maksimal 3.5 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLeaveAttachment(reader.result as string);
      setLeaveAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
  }

  // Handle Booking Submission
  async function submitBooking(e: FormEvent) {
    e.preventDefault();
    const chosenSlot = availableSlots.find((slot) => slot.startTime === selectedBookingTime);
    if (!chosenSlot?.available) {
      alert("Slot sudah tidak tersedia. Pilih slot lain yang masih tersedia.");
      setAvailabilityRefresh((current) => current + 1);
      return;
    }

    setBookingLoading(true);
    setBookingMsg("");
    try {
      const res = await apiRequest<{ message: string; booking: Booking }>("/counseling/bookings", {
        method: "POST",
        body: JSON.stringify({
          psychologistId: selectedPsychId,
          scheduledAt: new Date(`${bookingDate}T${selectedBookingTime}:00+07:00`).toISOString(),
          notes: bookingNotes || undefined
        })
      });
      setBookingMsg(res.message);
      setBookings([res.booking, ...bookings]);
      setAvailableSlots((current) => current.map((slot) => (
        slot.startTime === selectedBookingTime
          ? { ...slot, booked: true, available: false }
          : slot
      )));
      setSelectedBookingTime("");
      setBookingNotes("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal booking");
      setAvailabilityRefresh((current) => current + 1);
    } finally {
      setBookingLoading(false);
    }
  }

  // Handle Legal Complaint Submission
  async function submitComplaint(e: FormEvent) {
    e.preventDefault();
    setCompLoading(true);
    setCompMsg("");
    try {
      const res = await apiRequest<{ message: string; complaint: Complaint }>("/legal/complaints", {
        method: "POST",
        body: JSON.stringify({
          category: compCategory,
          counselId: compCounselId || undefined,
          title: compTitle,
          description: compDesc,
          incidentDate: new Date(compDate).toISOString(),
          location: compLocation || undefined,
          isAnonymous: compAnonymous,
          evidenceInfo: compEvidence || undefined
        })
      });
      setCompMsg(res.message);
      setComplaints([res.complaint, ...complaints]);
      setCompTitle("");
      setCompDesc("");
      setCompLocation("");
      setCompEvidence("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal membuat pengaduan");
    } finally {
      setCompLoading(false);
    }
  }

  // Handle ATMA Chat
  async function sendAtma(e: FormEvent) {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;

    setChatMessages((prev) => [...prev, { role: "user", text: msg }]);
    setChatInput("");
    setChatBusy(true);

    try {
      const res = await apiRequest<{
        reply: string;
        category: string;
        riskLevel: string;
        escalation: ChatMessage["escalation"];
      }>("/atma/chat", {
        method: "POST",
        body: JSON.stringify({ message: msg })
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: "atma",
          text: res.reply,
          category: res.category,
          riskLevel: res.riskLevel,
          escalation: res.escalation
        }
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "atma", text: "Maaf, koneksi ATMA sedang terganggu. Tarik napas perlahan dan coba beberapa saat lagi. 🌿" }
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  // Handle Mood Save
  async function handleSaveMood() {
    if (selectedMood === null) return;
    try {
      await apiRequest("/mood", {
        method: "POST",
        body: JSON.stringify({ mood: selectedMood + 1, note: moodNote || undefined })
      });
      setMoodSaved(true);
      setMoodNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan mood.");
    }
  }

  return (
    <div className="space-y-6">
      {loadError && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{loadError}</div>}
      {/* Employee Navigation Sub-Tabs */}
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        <div className="flex items-center gap-1.5 border-b border-[#E8ECE6] pb-3 text-xs font-bold text-[#556D62] min-w-max">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-2 rounded-xl transition-all ${activeTab === "overview" ? "bg-[#294D3F] text-white shadow-sm" : "hover:bg-[#EAF0EC]"}`}
          >
            Ringkasan &amp; Mood
          </button>
          <button
            onClick={() => setActiveTab("leaves")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === "leaves" ? "bg-[#294D3F] text-white shadow-sm" : "hover:bg-[#EAF0EC]"}`}
          >
            <FileText size={14} /> Surat Ijin
          </button>
          <button
            onClick={() => setActiveTab("counseling")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === "counseling" ? "bg-[#294D3F] text-white shadow-sm" : "hover:bg-[#EAF0EC]"}`}
          >
            <CalendarDays size={14} /> Booking Psikolog
          </button>
          <button
            onClick={() => setActiveTab("atma")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === "atma" ? "bg-[#294D3F] text-white shadow-sm" : "hover:bg-[#EAF0EC]"}`}
          >
            <MessageCircle size={14} /> ATMA
          </button>
          <button
            onClick={() => setActiveTab("complaints")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === "complaints" ? "bg-[#294D3F] text-white shadow-sm" : "hover:bg-[#EAF0EC]"}`}
          >
            <Scale size={14} /> Pengaduan Hukum
          </button>
          <button
            onClick={() => setActiveTab("tracker")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === "tracker" ? "bg-[#294D3F] text-white shadow-sm" : "hover:bg-[#EAF0EC]"}`}
          >
            <Clock3 size={14} /> Live Status Tracker
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & MOOD */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-[#315746] text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">RUANG KESEJAHTERAAN KARYAWAN</span>
              <h2 className="text-2xl font-extrabold">Halo, {user.name} 👋</h2>
              <p className="text-xs text-[#D1DFD5] leading-relaxed">
                Divisi: <strong>{user.department || "Operasional"}</strong> · Posisi: <strong>{user.position || "Karyawan"}</strong>. Luangkan waktu sejenak untuk memeriksa ritme perasaanmu hari ini.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("atma")}
                className="px-4 py-2.5 rounded-xl bg-white text-[#294D3F] text-xs font-bold hover:bg-[#EAF0EC] transition-all flex items-center gap-2"
              >
                <MessageCircle size={14} /> Bicara dengan ATMA
              </button>
            </div>
          </div>

          {/* Daily Mood Check-In */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#1E392F]">Bagaimana suasana hatimu hari ini?</h3>
                  <p className="text-xs text-[#70857A]">Check-in ini bersifat privat dan hanya untukmu.</p>
                </div>
                <span className="text-[11px] font-semibold text-[#4A6B5D] bg-[#EAF0EC] px-2 py-1 rounded-md">Hari Ini</span>
              </div>

              <div className="grid grid-cols-5 gap-2 pt-2">
                {[
                  { label: "Berat", icon: "😞", val: 0 },
                  { label: "Kurang", icon: "😕", val: 1 },
                  { label: "Biasa", icon: "😐", val: 2 },
                  { label: "Baik", icon: "🙂", val: 3 },
                  { label: "Hebat", icon: "😊", val: 4 }
                ].map((m) => (
                  <button
                    key={m.val}
                    type="button"
                    onClick={() => { setSelectedMood(m.val); setMoodSaved(false); }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${selectedMood === m.val ? "border-[#294D3F] bg-[#EAF0EC] shadow-sm scale-105" : "border-[#E8ECE6] hover:bg-[#F8FAF9]"}`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-[10px] font-bold text-[#294D3F]">{m.label}</span>
                  </button>
                ))}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Catatan kecil suasana hatimu (opsional)..."
                  value={moodNote}
                  onChange={(e) => setMoodNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-[#FBF9F5] text-xs focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {moodSaved ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <Check size={14} /> Check-in tersimpan. Terima kasih telah merawat diri!
                  </span>
                ) : <span />}
                <button
                  type="button"
                  disabled={selectedMood === null}
                  onClick={handleSaveMood}
                  className="px-4 py-2 rounded-xl bg-[#294D3F] text-white text-xs font-bold shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
                >
                  Simpan Check-In
                </button>
              </div>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setActiveTab("leaves")}
                className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm cursor-pointer hover:border-[#3D6953] transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#71857B]">Surat Izin Saya</span>
                  <div className="w-8 h-8 rounded-lg bg-[#EAF0EC] text-[#294D3F] flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#1E392F]">{leaves.length}</div>
                  <div className="text-[11px] text-[#5C7167] mt-0.5">
                    {leaves.filter(l => l.status === "PENDING").length} menunggu approval HRD
                  </div>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("counseling")}
                className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm cursor-pointer hover:border-[#3D6953] transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#71857B]">Janji Konseling</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <CalendarDays size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#1E392F]">{bookings.length}</div>
                  <div className="text-[11px] text-[#5C7167] mt-0.5">
                    {bookings.filter(b => b.status === "CONFIRMED").length} sesi aktif
                  </div>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("complaints")}
                className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm cursor-pointer hover:border-[#3D6953] transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#71857B]">Laporan Hukum</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Scale size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#1E392F]">{complaints.length}</div>
                  <div className="text-[11px] text-[#5C7167] mt-0.5">
                    {complaints.filter(c => c.status !== "RESOLVED").length} dalam pendampingan
                  </div>
                </div>
              </div>

              <div
                onClick={() => setActiveTab("tracker")}
                className="bg-white rounded-2xl p-5 border border-[#E8ECE6] shadow-sm cursor-pointer hover:border-[#3D6953] transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#71857B]">Live Tracker</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Clock3 size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1E392F]">Approval & Kasus</div>
                  <div className="text-[11px] text-[#5C7167] mt-0.5">Pantau linimasa transparan</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SURAT IZIN (CUTI, SAKIT, DINAS) */}
      {activeTab === "leaves" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Form Pengajuan */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-[#E8ECE6] shadow-sm space-y-3">
            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">FORMULIR PENGAJUAN</span>
              <h3 className="text-base font-bold text-[#1E392F]">Ajukan Surat Izin Kerja</h3>
              <p className="text-xs text-[#5D7369]">Pilih jenis izin (Cuti tahunan, Sakit, atau Dinas luar kota).</p>
            </div>

            {leaveMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {leaveMsg}
              </div>
            )}

            <form onSubmit={submitLeave} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Jenis Izin</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CUTI", "SAKIT", "DINAS"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLeaveType(t)}
                      className={`py-2 rounded-xl border font-bold transition-colors ${leaveType === t ? "bg-[#294D3F] text-white border-[#294D3F]" : "border-[#CBD5CD] bg-[#FBF9F5] text-[#294D3F] hover:bg-[#EAF0EC]"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Mulai Tanggal</label>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Sampai Tanggal</label>
                  <input
                    type="date"
                    required
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                  />
                </div>
              </div>

              {leaveStart && leaveEnd && new Date(leaveEnd) >= new Date(leaveStart) && (
                <div className="px-3 py-2 rounded-xl bg-[#EAF0EC] border border-[#C6D9CD] text-xs text-[#294D3F] font-semibold">
                  📅 Durasi: <strong>
                    {(() => {
                      let count = 0;
                      const c = new Date(leaveStart);
                      const end = new Date(leaveEnd);
                      while (c <= end) {
                        const d = c.getDay();
                        if (d !== 0 && d !== 6) count++;
                        c.setDate(c.getDate() + 1);
                      }
                      return count < 1 ? 1 : count;
                    })()} hari kerja
                  </strong> ({new Date(leaveStart).toLocaleDateString("id-ID")} – {new Date(leaveEnd).toLocaleDateString("id-ID")})
                </div>
              )}

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Alasan Pengajuan</label>
                <textarea
                  rows={2}
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Jelaskan kebutuhan izin atau istirahat Anda..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Lampiran Surat / Foto Dokumen <span className="font-normal text-[#7A8E83]">(Opsional)</span></label>
                <label className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border-2 border-dashed border-[#CBD5CD] bg-[#FBF9F5] cursor-pointer hover:border-[#294D3F] hover:bg-[#EAF0EC] transition-all">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={handleAttachmentFile}
                  />
                  {leaveAttachmentName ? (
                    <>
                      <span className="text-base">📎</span>
                      <span className="truncate flex-1 text-[#294D3F] font-semibold">{leaveAttachmentName}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setLeaveAttachment(""); setLeaveAttachmentName(""); }}
                        className="text-red-500 hover:text-red-700 font-bold shrink-0"
                      >✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-base">📂</span>
                      <div>
                        <p className="font-semibold text-[#556D62]">Upload foto / file dokumen</p>
                        <p className="text-[10px] text-[#7A8E83]">JPG, PNG, PDF, DOC — Maks. 3.5 MB</p>
                      </div>
                    </>
                  )}
                </label>
              </div>

              <button
                type="submit"
                disabled={leaveLoading}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {leaveLoading ? "Mengajukan..." : "Kirim Permohonan Izin"}
              </button>
            </form>
          </div>

          {/* Riwayat & Live Status Tracker Surat Izin */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-6 border border-[#E8ECE6] shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">APPROVAL TRACKER</span>
              <h3 className="text-lg font-bold text-[#1E392F]">Riwayat & Status Surat Izin Saya</h3>
              <p className="text-xs text-[#5D7369]">Pantau proses persetujuan oleh tim HRD secara transparan.</p>
            </div>

            <div className="space-y-4">
              {leaves.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A8E83] border border-dashed rounded-xl">
                  Belum ada permohonan surat izin. Gunakan formulir di sebelah kiri untuk mengajukan.
                </div>
              ) : (
                leaves.map((l) => (
                  <div key={l.id} className="p-4 rounded-xl border border-[#E8ECE6] bg-[#FBF9F5] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-[#EAF0EC] text-[#294D3F]">
                          {l.type}
                        </span>
                        <span className="text-xs font-bold text-[#1E392F]">{l.daysCount} Hari</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : l.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {l.status === "APPROVED" ? "Disetujui HRD" : l.status === "REJECTED" ? "Ditolak HRD" : "Menunggu Verifikasi HRD"}
                      </span>
                    </div>

                    <div className="text-xs text-[#5C7167]">
                      <div><strong>Periode:</strong> {new Date(l.startDate).toLocaleDateString("id-ID")} - {new Date(l.endDate).toLocaleDateString("id-ID")}</div>
                      <div className="mt-1"><strong>Alasan:</strong> {l.reason}</div>
                      {l.attachmentUrl && (
                        <div className="mt-1.5">
                          {l.attachmentUrl.startsWith("data:image") ? (
                            <a href={l.attachmentUrl} target="_blank" rel="noreferrer">
                              <img src={l.attachmentUrl} alt="Lampiran" className="h-16 rounded-lg border border-[#CBD5CD] object-cover cursor-pointer hover:opacity-80" />
                            </a>
                          ) : l.attachmentUrl.startsWith("data:") ? (
                            <a href={l.attachmentUrl} download="lampiran" className="text-[10px] text-blue-700 underline flex items-center gap-1">
                              📎 Unduh Lampiran
                            </a>
                          ) : (
                            <a href={l.attachmentUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline truncate block">
                              Lampiran: {l.attachmentUrl}
                            </a>
                          )}
                        </div>
                      )}
                      {l.hrNotes && (
                        <div className="mt-1.5 p-2 rounded-lg bg-white border border-[#E2DBD1] text-[11px] text-[#294D3F]">
                          <strong>Catatan HRD ({l.reviewedBy}):</strong> {l.hrNotes}
                        </div>
                      )}
                    </div>

                    {l.status === "APPROVED" && (
                      <div className="flex justify-end">
                        <PdfDownloadButton
                          path={`/documents/leaves/${encodeURIComponent(l.id)}.pdf`}
                          filename={`surat-izin-${l.id}.pdf`}
                        />
                      </div>
                    )}

                    {/* Visual Status Step Indicator */}
                    <div className="pt-2 border-t border-[#EAEFEA] flex items-center justify-between text-[10px] font-semibold">
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={13} /> 1. Diajukan
                      </span>
                      <span className={l.status !== "PENDING" ? "text-emerald-700 flex items-center gap-1" : "text-[#91A299]"}>
                        <CheckCircle2 size={13} /> 2. Ditinjau HRD
                      </span>
                      <span className={l.status === "APPROVED" ? "text-emerald-700 flex items-center gap-1" : l.status === "REJECTED" ? "text-red-700 flex items-center gap-1" : "text-[#91A299]"}>
                        <CheckCircle2 size={13} /> 3. {l.status === "REJECTED" ? "Ditolak" : "Persetujuan"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BOOKING PSIKOLOG */}
      {activeTab === "counseling" && (
        <div className="space-y-4">
          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#E8ECE6] pb-3">
            <button
              onClick={() => setCounselingSubTab("booking")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${counselingSubTab === "booking" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
            >
              <CalendarDays size={14} /> Booking Konseling
            </button>
            <button
              onClick={() => setCounselingSubTab("education")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${counselingSubTab === "education" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
            >
              <Heart size={14} /> Kesehatan Mental
            </button>
          </div>

        {counselingSubTab === "booking" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-6 border border-[#E8ECE6] shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">EMPLOYEE ASSISTANCE PROGRAM</span>
              <h3 className="text-lg font-bold text-[#1E392F]">Jadwalkan Konseling Psikolog</h3>
              <p className="text-xs text-[#5D7369]">Konsultasi 1-on-1 privat untuk memulihkan stres dan kelelahan mental.</p>
            </div>

            {bookingMsg && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                {bookingMsg}
              </div>
            )}

            <form onSubmit={submitBooking} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Pilih Psikolog Klinis</label>
                <select
                  required
                  value={selectedPsychId}
                  onChange={(e) => {
                    setSelectedPsychId(e.target.value);
                    setSelectedBookingTime("");
                    setAvailableSlots([]);
                    setAvailabilityError("");
                    setAvailabilityLoading(Boolean(e.target.value && bookingDate));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                >
                  <option value="">-- Pilih Dokter / Psikolog --</option>
                  {psychologists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position || "Psikolog"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Show practice slots of selected psychologist */}
              {selectedPsychId && (
                <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E0E7E2] space-y-1.5">
                  <div className="font-bold text-[#294D3F] text-[11px]">Jadwal Praktik Mingguan:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {weeklyPracticeSlots.map((s) => (
                      <span key={s.id} className="px-2 py-0.5 rounded bg-white border border-[#CBD5CD] text-[10px] text-[#294D3F]">
                        {s.day}: {s.time}
                      </span>
                    ))}
                    {weeklyPracticeSlots.length === 0 && (
                      <span className="text-[11px] text-[#71857B]">Psikolog belum membuka slot praktik; booking belum tersedia.</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Tanggal Konsultasi</label>
                <input
                  type="date"
                  required
                  value={bookingDate}
                  min={minimumBookingDate}
                  onChange={(e) => {
                    setBookingDate(e.target.value);
                    setSelectedBookingTime("");
                    setAvailableSlots([]);
                    setAvailabilityError("");
                    setAvailabilityLoading(Boolean(e.target.value && selectedPsychId));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              {selectedPsychId && bookingDate && (
                <div className="p-3 rounded-xl bg-[#F8FAF9] border border-[#E0E7E2] space-y-2">
                  <div className="font-bold text-[#294D3F] text-[11px]">
                    Ketersediaan {new Date(`${bookingDate}T12:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" })}:
                  </div>
                  {availabilityError && <p role="alert" className="text-[11px] text-red-700">{availabilityError}</p>}
                  {availabilityLoading ? (
                    <p className="text-[11px] text-[#71857B]">Memeriksa ketersediaan...</p>
                  ) : availabilityError ? null : availableSlots.length === 0 ? (
                    <p className="text-[11px] text-[#71857B]">Tidak ada slot praktik pada tanggal ini.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setSelectedBookingTime(slot.startTime)}
                            className={`p-2 rounded-lg border text-left transition-colors ${
                              slot.available
                                ? selectedBookingTime === slot.startTime
                                  ? "border-[#294D3F] bg-[#EAF0EC] text-[#1E392F]"
                                  : "border-[#CBD5CD] bg-white text-[#294D3F] hover:bg-[#EAF0EC]"
                                : "border-[#E2DBD1] bg-[#F2F1EE] text-[#89938D] cursor-not-allowed"
                            }`}
                          >
                            <span className="block font-bold">{slot.time}</span>
                            <span className="block text-[10px]">
                              {slot.booked ? "Sudah dibooking" : slot.past ? "Waktu sudah lewat" : `Pilih jam mulai ${slot.startTime}`}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-[#71857B]">
                        Informasi hanya menunjukkan ketersediaan, tanpa menampilkan identitas karyawan lain. Booking dilakukan pada jam mulai slot.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Keluhan Awal / Hal yang Ingin Dibahas</label>
                <textarea
                  rows={3}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="cth: Cemas berlebihan terkait target pekerjaan, insomnia, burnout..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#F4F7F4] text-[11px] text-[#4A6B5D] flex items-center gap-2">
                <ShieldCheck size={16} />
                <span>Kerahasiaan medis dijamin. Sesi telekonseling bersifat 100% tertutup.</span>
              </div>

              <button
                type="submit"
                disabled={bookingLoading || !selectedBookingTime}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {bookingLoading ? "Mengirim..." : "Kirim Permintaan Konseling"}
              </button>
            </form>
          </div>

          {/* Riwayat Konseling & Catatan Klinis */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-6 border border-[#E8ECE6] shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">SESI KONSELING SAYA</span>
              <h3 className="text-lg font-bold text-[#1E392F]">Jadwal & Catatan Medis Psikologis</h3>
              <p className="text-xs text-[#5D7369]">Lihat konfirmasi jadwal dan rekomendasi pemulihan dari psikolog.</p>
            </div>

            <div className="space-y-4">
              {bookings.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A8E83] border border-dashed rounded-xl">
                  Belum ada sesi konseling. Jadwalkan sesi di formulir sebelah kiri.
                </div>
              ) : (
                bookings.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl border border-[#E8ECE6] bg-[#FBF9F5] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-[#1E392F]">
                        Bersama: {b.psychologist.name}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : b.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="text-xs text-[#5C7167] space-y-1">
                      <div><strong>Jadwal:</strong> {new Date(b.scheduledAt).toLocaleString("id-ID")}</div>
                      {b.notes && <div><strong>Keluhan awal:</strong> {b.notes}</div>}
                      {b.counselingUrl && (
                        <div className="pt-1">
                          <a href={b.counselingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-700 font-bold hover:underline">
                            <span>Buka Ruang Sesi Telehealth</span>
                            <ArrowRight size={12} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Sesi Selesai: Catatan Psikolog & Action Plan */}
                    {b.clinicalNotes && (
                      <div className="p-3 rounded-xl bg-white border border-[#CBD5CD] space-y-1.5 text-xs text-[#294D3F]">
                        <div className="font-bold flex items-center gap-1.5 text-[#3D6953]">
                          <Activity size={14} /> Catatan Medis & Refleksi Psikolog:
                        </div>
                        <p className="text-[11px] text-[#556D62]">{b.clinicalNotes}</p>
                        {b.actionPlan && (
                          <div className="pt-1 border-t border-[#F0F4F1] mt-1">
                            <span className="font-bold text-[11px]">Rencana Pemulihan (Action Plan):</span>
                            <p className="text-[11px] text-[#556D62]">{b.actionPlan}</p>
                          </div>
                        )}
                        {(b.status === "CONFIRMED" || b.status === "COMPLETED") && (
                          <div className="flex justify-end">
                            <PdfDownloadButton
                              path={`/documents/bookings/${encodeURIComponent(b.id)}.pdf`}
                              filename={`konseling-${b.id}.pdf`}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        {counselingSubTab === "education" && (
          <div className="space-y-5">
            <div className="bg-[#315746] text-white rounded-3xl p-6 sm:p-8 shadow-sm">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">MENTAL HEALTH EDUCATION</span>
              <h2 className="text-2xl font-extrabold mt-1">Kesehatan Mental di Tempat Kerja</h2>
              <p className="text-xs text-[#D1DFD5] mt-2 leading-relaxed max-w-2xl">
                Kesehatan mental sama pentingnya dengan menjaga kesehatan fisik — terutama di tengah rutinitas dan tuntutan pekerjaan sehari-hari. Sebagai fondasi kesejahteraan emosional, psikologis, dan sosial, kesehatan mental menentukan cara kita berpikir, merasakan, dan menghadapi tekanan hidup.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-[#1E392F] mb-3">Tantangan Kesehatan Mental di Dunia Kerja</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { emoji: "😓", title: "Stres Kerja", color: "border-amber-200 bg-amber-50", titleColor: "text-amber-900", desc: "Muncul ketika tuntutan pekerjaan melebihi kapasitas diri — akibat beban berlebih atau tenggat waktu yang ketat. Dapat dikelola melalui manajemen waktu dan komunikasi terbuka." },
                  { emoji: "🔥", title: "Burnout", color: "border-red-200 bg-red-50", titleColor: "text-red-900", desc: "Kondisi kelelahan berkepanjangan dengan sikap negatif pada pekerjaan dan penurunan produktivitas. Memerlukan pemulihan nyata dan keseimbangan hidup yang lebih sehat." },
                  { emoji: "😰", title: "Kecemasan Karier", color: "border-purple-200 bg-purple-50", titleColor: "text-purple-900", desc: "Tuntutan performa sering memicu kecemasan atas ketidakpastian karier. Jika berlangsung terus-menerus dan mengganggu aktivitas, perlu ditangani bersama tenaga profesional." },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl border p-4 ${card.color} space-y-2 text-xs`}>
                    <div className="text-2xl">{card.emoji}</div>
                    <div className={`font-extrabold text-sm ${card.titleColor}`}>{card.title}</div>
                    <p className="leading-relaxed opacity-90 text-[#3D4A43]">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
              <div className="bg-[#294D3F] px-5 py-3 flex items-center gap-2">
                <Heart size={15} className="text-[#C6D9CD]" />
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Menjaga Kesejahteraan Emosional di Tempat Kerja</h4>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#3D5247]">
                {[
                  { icon: "🧘", title: "Kelola Emosi dengan Sehat", desc: "Saat menghadapi tekanan atau kritik, kenali sumbernya dan respons secara sehat — lewat jeda sejenak atau latihan pernapasan." },
                  { icon: "🌿", title: "Self-Care Bukan Kemalasan", desc: "Tidur cukup, menjaga nutrisi, menjalani hobi, dan beristirahat adalah cara penting menjaga energi agar tetap optimal." },
                  { icon: "⚖️", title: "Work-Life Balance", desc: "Bagi waktu dan energi secara adil antara karier dan kehidupan pribadi untuk mencegah kelelahan berlebih." },
                  { icon: "🤝", title: "Lingkungan Kerja Suportif", desc: "Hubungan kerja yang terbuka, bebas dari intimidasi dan diskriminasi, menciptakan rasa aman psikologis." },
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

            <div className="bg-[#EAF0EC] border border-[#C6D9CD] rounded-2xl p-5 flex items-start gap-4">
              <span className="text-3xl shrink-0">💬</span>
              <div className="text-xs text-[#294D3F]">
                <div className="font-extrabold text-sm mb-1">Hapus Stigma Kesehatan Mental</div>
                <p className="leading-relaxed">Apabila tekanan emosional mulai terasa berat dan mengganggu kehidupan sosial maupun pekerjaan, jangan ragu mencari bantuan profesional. Masalah mental bukanlah sebuah kelemahan — setiap individu berhak mendapatkan pemahaman dan dukungan penuh tanpa dihakimi.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#294D3F] text-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">Merasa butuh bantuan profesional?</p>
                <p className="text-[11px] text-[#C6D9CD] mt-0.5">Jadwalkan sesi konseling 1-on-1 privat bersama psikolog klinis berlisensi Wellfora.</p>
              </div>
              <button
                onClick={() => setCounselingSubTab("booking")}
                className="shrink-0 px-4 py-2 rounded-xl bg-white text-[#294D3F] text-xs font-bold hover:bg-[#EAF0EC] transition-all flex items-center gap-1.5"
              >
                <CalendarDays size={13} /> Booking Sekarang
              </button>
            </div>
          </div>
        )}
        </div>
      )}

      {/* TAB 4: ATMA CHATBOT WITH RISK & ESCALATION DETECTION */}
      {activeTab === "atma" && (
        <div className="bg-white rounded-3xl border border-[#E8ECE6] shadow-sm flex flex-col h-[min(70vh,650px)] min-h-[440px] overflow-hidden">
          <div className="p-4 bg-[#1B382B] text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">ATMA</h3>
                <span className="text-[11px] text-white/70">Asisten Teman Mental Anda · tersedia 24/7</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Aktif
            </span>
          </div>

          {/* Chat Transcript Area */}
          <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#FBF9F5]" aria-live="polite">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[90%] sm:max-w-xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${msg.role === "user" ? "bg-[#1B382B] text-white" : "bg-white text-[#1F382E] border border-[#E8ECE6]"}`}>
                  <p>{msg.text}</p>

                  {/* Escalation Action Card when Risk is Detected */}
                  {msg.escalation && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#F8FAF9] border border-[#C5D2CA] text-[#1E392F] space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-[#294D3F]">
                        {msg.escalation.type === "BOOK_PSYCHOLOGIST" ? (
                          <Heart size={16} className="text-red-500" />
                        ) : (
                          <ShieldAlert size={16} className="text-amber-600" />
                        )}
                        <span>{msg.escalation.title}</span>
                      </div>
                      <p className="text-[11px] text-[#556960]">{msg.escalation.description}</p>
                      <button
                        onClick={() => {
                          if (msg.escalation) setActiveTab(msg.escalation.actionTab);
                        }}
                        className="w-full py-2 rounded-lg bg-[#294D3F] text-white text-xs font-bold hover:bg-[#1E392F] transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>{msg.escalation.actionText}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[#86998F] mt-1 px-1">
                  {msg.role === "user" ? "Kamu" : "ATMA"}
                </span>
              </div>
            ))}
            {chatBusy && (
              <div className="flex items-center gap-2 text-xs text-[#5A6F66] italic">
                <Sparkles size={14} className="animate-spin text-[#294D3F]" />
                <span>ATMA sedang menyimak ceritamu...</span>
              </div>
            )}
          </div>

          {/* Chat Composer */}
          <form onSubmit={sendAtma} className="p-3 sm:p-4 bg-white border-t border-[#E8ECE6] flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              aria-label="Pesan untuk ATMA"
              placeholder="Ceritakan perasaanmu, kelelahan kerja, atau situasi yang sedang kamu hadapi..."
              className="min-w-0 flex-1 px-4 py-2.5 rounded-xl border border-[#CBD5CD] bg-[#FBF9F5] text-xs sm:text-sm focus:outline-none focus:border-[#1B382B]"
            />
            <button
              type="submit"
              disabled={chatBusy || !chatInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#294D3F] text-white text-xs font-bold hover:bg-[#1E392F] transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send size={15} />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: PENGADUAN HUKUM / KASUS */}
      {activeTab === "complaints" && (
        <div className="space-y-4">
          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#E8ECE6] pb-3">
            <button
              onClick={() => setComplaintsSubTab("form")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${complaintsSubTab === "form" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
            >
              <Scale size={14} /> Ajukan & Riwayat Pengaduan
            </button>
            <button
              onClick={() => setComplaintsSubTab("knowledge")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${complaintsSubTab === "knowledge" ? "bg-[#294D3F] text-white shadow-sm" : "text-[#556D62] hover:bg-[#EAF0EC]"}`}
            >
              <BookOpen size={14} /> Info Hak & Perlindungan Kerja
            </button>
          </div>

        {complaintsSubTab === "form" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-6 border border-[#E8ECE6] shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">KANAL PERLINDUNGAN PEKERJA</span>
              <h3 className="text-lg font-bold text-[#1E392F]">Buat Pengaduan Kasus Hukum</h3>
              <p className="text-xs text-[#5D7369]">Pelecehan seksual, intimidasi, kekerasan, atau pelanggaran upah.</p>
            </div>

            {compMsg && (
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900">
                {compMsg}
              </div>
            )}

            <form onSubmit={submitComplaint} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Kategori Pelanggaran</label>
                <select
                  required
                  value={compCategory}
                  onChange={(e) => setCompCategory(e.target.value as Complaint["category"])}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                >
                  <option value="PELECEHAN_SEKSUAL">Pelecehan Seksual (Verbal / Fisik)</option>
                  <option value="KEKERASAN_INTIMIDASI">Kekerasan Fisik / Intimidasi & Ancaman</option>
                  <option value="PELANGGARAN_HUKUM_KERJA">Pelanggaran Hak Kerja (Lembur Paksa/Upah)</option>
                  <option value="DISKRIMINASI">Diskriminasi SARA / Gender</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Petugas Legal</label>
                <select
                  value={compCounselId}
                  onChange={(e) => setCompCounselId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                >
                  <option value="">Ditugaskan otomatis oleh tim hukum</option>
                  {legalStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}{staff.department ? ` · ${staff.department}` : ""}
                    </option>
                  ))}
                </select>
                {legalStaff.length === 0 && (
                  <p className="mt-1 text-[10px] text-[#71857B]">Belum ada petugas legal aktif; laporan akan ditugaskan otomatis jika tersedia.</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Judul Laporan</label>
                <input
                  type="text"
                  required
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  placeholder="Ringkasan insiden secara jelas..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Tanggal Kejadian</label>
                  <input
                    type="date"
                    required
                    value={compDate}
                    onChange={(e) => setCompDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#294D3F] mb-1">Lokasi Insiden</label>
                  <input
                    type="text"
                    value={compLocation}
                    onChange={(e) => setCompLocation(e.target.value)}
                    placeholder="Ruang rapat / Online Slack"
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Kronologi Kejadian</label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  value={compDesc}
                  onChange={(e) => setCompDesc(e.target.value)}
                  placeholder="Jelaskan secara runtut apa yang terjadi, siapa pihak terkait, dan dampaknya..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#294D3F] mb-1">Bukti Pendukung / Saksi</label>
                <input
                  type="text"
                  value={compEvidence}
                  onChange={(e) => setCompEvidence(e.target.value)}
                  placeholder="cth: Tangkapan layar WhatsApp, nama saksi, rekaman..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5CD] bg-white focus:outline-none focus:border-[#294D3F]"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/60 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="anonCheck"
                  checked={compAnonymous}
                  onChange={(e) => setCompAnonymous(e.target.checked)}
                  className="mt-0.5"
                />
                <label htmlFor="anonCheck" className="text-[11px] text-purple-900 cursor-pointer">
                  <strong>Kirim sebagai Laporan Anonim (Whistleblower Protection)</strong>
                  <p className="text-[10px] text-purple-700 mt-0.5">Identitas akun dan nomor internal tidak ditampilkan kepada tim penanganan.</p>
                </label>
              </div>

              <button
                type="submit"
                disabled={compLoading}
                className="w-full py-2.5 rounded-xl bg-[#294D3F] text-white font-bold shadow hover:bg-[#1E392F] transition-all disabled:opacity-50"
              >
                {compLoading ? "Mengirim Laporan..." : "Kirim Laporan Resmi ke Tim Hukum"}
              </button>
            </form>
          </div>

          {/* Daftar Pengaduan & Live Status Case Tracker */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-6 border border-[#E8ECE6] shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">CASE TRACKER</span>
              <h3 className="text-lg font-bold text-[#1E392F]">Laporan & Tindak Lanjut Hukum</h3>
              <p className="text-xs text-[#5D7369]">Tahapan investigasi, mediasi, dan keputusan advokat legal.</p>
            </div>

            <div className="space-y-4">
              {complaints.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A8E83] border border-dashed rounded-xl">
                  Belum ada laporan pengaduan hukum yang diajukan.
                </div>
              ) : (
                complaints.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl border border-[#E8ECE6] bg-[#FBF9F5] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#294D3F] bg-[#EAF0EC] px-2 py-0.5 rounded">
                          {c.ticketNumber}
                        </span>
                        {c.isAnonymous && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                            Anonim
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        {c.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-[#1E392F]">{c.title}</h4>
                      <p className="text-xs text-[#5C7167] mt-1">{c.description}</p>
                    </div>

                    {(c.status === "RESOLVED" || c.status === "CLOSED") && (
                      <div className="flex justify-end">
                        <PdfDownloadButton
                          path={`/documents/complaints/${encodeURIComponent(c.id)}.pdf`}
                          filename={`berkas-hukum-${c.ticketNumber}.pdf`}
                        />
                      </div>
                    )}

                    {/* Visual Status Step Indicator for Legal Cases */}
                    <div className="pt-2 border-t border-[#EAEFEA] grid grid-cols-5 text-center text-[9px] font-bold gap-1">
                      <div className="p-1 rounded bg-emerald-100 text-emerald-800">1. Laporan</div>
                      <div className={`p-1 rounded ${c.status !== "SUBMITTED" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>2. Ditinjau</div>
                      <div className={`p-1 rounded ${["INVESTIGATION", "MEDIATION", "RESOLVED"].includes(c.status) ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>3. Investigasi</div>
                      <div className={`p-1 rounded ${["MEDIATION", "RESOLVED"].includes(c.status) ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>4. Mediasi</div>
                      <div className={`p-1 rounded ${c.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>5. Selesai</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        {/* Sub-tab: Info Hak & Perlindungan Kerja */}
        {complaintsSubTab === "knowledge" && (
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

            {/* Hukum Ketenagakerjaan */}
            <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
              <div className="bg-[#294D3F] px-5 py-3 flex items-center gap-2">
                <Scale size={15} className="text-[#C6D9CD]" />
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Mengenal Hukum Ketenagakerjaan</h4>
              </div>
              <div className="p-5 text-xs text-[#3D5247] leading-relaxed">
                Hukum ketenagakerjaan mengatur hubungan antara pekerja, perusahaan, dan pemerintah — mulai dari sebelum bekerja, selama bekerja, hingga berakhirnya hubungan kerja. Tujuannya adalah menciptakan hubungan industrial yang adil dan seimbang.
              </div>
            </div>

            {/* Hak & Kewajiban Pekerja */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
                <div className="bg-emerald-700 px-5 py-3 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-200" />
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

              <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
                <div className="bg-blue-700 px-5 py-3 flex items-center gap-2">
                  <UserCheck size={15} className="text-blue-200" />
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
                <ShieldAlert size={15} className="text-purple-200" />
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Hak & Kewajiban Perusahaan</h4>
              </div>
              <div className="p-5 space-y-3 text-xs text-[#3D5247]">
                <p className="leading-relaxed">Perusahaan berhak mengelola operasional, memberikan instruksi, menetapkan standar kinerja, dan menegakkan disiplin sesuai ketentuan hukum.</p>
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

            {/* Topik Penting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: "📄", color: "bg-amber-50 border-amber-200 text-amber-900", title: "Perjanjian Kerja & Upah", desc: "Perjanjian kerja memuat hak, kewajiban, serta syarat kerja. Pahami ketentuan upah dan lembur sebelum menandatangani kontrak." },
                { icon: "⚠️", color: "bg-red-50 border-red-200 text-red-900", title: "PHK & Hak Pesangon", desc: "Pemutusan Hubungan Kerja (PHK) wajib mengikuti prosedur hukum dengan tetap memperhatikan hak pekerja seperti pesangon atau kompensasi." },
                { icon: "🛡️", color: "bg-emerald-50 border-emerald-200 text-emerald-900", title: "K3 & Perlindungan Kerja", desc: "Setiap pekerja berhak atas lingkungan kerja aman, bebas pelecehan dan diskriminasi, serta perlindungan Keselamatan dan Kesehatan Kerja (K3)." },
                { icon: "⚖️", color: "bg-blue-50 border-blue-200 text-blue-900", title: "Perselisihan & BPJS", desc: "Penyelesaian perselisihan melalui perundingan bipartit, mediasi, hingga Pengadilan Hubungan Industrial. Pekerja berhak atas BPJS Ketenagakerjaan." },
              ].map((card, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${card.color} space-y-1.5 text-xs`}>
                  <div className="flex items-center gap-2 font-extrabold"><span>{card.icon}</span>{card.title}</div>
                  <p className="leading-relaxed opacity-90">{card.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA ke pengaduan */}
            <div className="p-4 rounded-xl bg-[#294D3F] text-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold">Mengalami pelanggaran hak di tempat kerja?</p>
                <p className="text-[11px] text-[#C6D9CD] mt-0.5">Tim advokat Wellfora siap mendampingi kasusmu secara rahasia.</p>
              </div>
              <button
                onClick={() => setComplaintsSubTab("form")}
                className="shrink-0 px-4 py-2 rounded-xl bg-white text-[#294D3F] text-xs font-bold hover:bg-[#EAF0EC] transition-all flex items-center gap-1.5"
              >
                <Scale size={13} /> Ajukan Pengaduan
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6] text-[11px] text-[#5D7369] text-center">
              Pekerja dapat mengakses bantuan hukum termasuk melalui <strong>Wellfora</strong> ketika menghadapi permasalahan atau pelanggaran hak di tempat kerja.
            </div>
          </div>
        )}
        </div>
      )}

      {/* TAB 6: LIVE STATUS TRACKER TERPADU */}
      {activeTab === "tracker" && (
        <div className="bg-white rounded-2xl p-6 border border-[#E8ECE6] shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-bold text-[#4A6B5D] uppercase tracking-wider">TRANSPARANSI PROSES TERPADU</span>
            <h3 className="text-xl font-bold text-[#1E392F]">Live Status & Approval Tracker</h3>
            <p className="text-xs text-[#5D7369]">
              Semua permohonan surat izin, janji temu psikolog, dan kasus pengaduan hukum Anda berada dalam pengawasan langsung.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Surat Izin Tracker */}
            <div className="space-y-3 p-4 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6]">
              <div className="flex items-center gap-2 font-bold text-xs text-[#294D3F]">
                <FileText size={16} />
                <span>Surat Izin HRD ({leaves.length})</span>
              </div>
              <div className="space-y-2 text-xs">
                {leaves.map((l) => (
                  <div key={l.id} className="p-2.5 rounded-lg bg-white border border-[#E8ECE6]">
                    <div className="flex justify-between font-bold">
                      <span>{l.type} ({l.daysCount} hari)</span>
                      <span className={l.status === "APPROVED" ? "text-emerald-700" : "text-amber-700"}>{l.status}</span>
                    </div>
                    <div className="text-[11px] text-[#70857A] mt-1">{new Date(l.startDate).toLocaleDateString("id-ID")}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Konseling Tracker */}
            <div className="space-y-3 p-4 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6]">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-800">
                <CalendarDays size={16} />
                <span>Konseling Psikolog ({bookings.length})</span>
              </div>
              <div className="space-y-2 text-xs">
                {bookings.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-lg bg-white border border-[#E8ECE6]">
                    <div className="flex justify-between font-bold">
                      <span>{b.psychologist.name}</span>
                      <span className="text-blue-700">{b.status}</span>
                    </div>
                    <div className="text-[11px] text-[#70857A] mt-1">{new Date(b.scheduledAt).toLocaleString("id-ID")}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Tracker */}
            <div className="space-y-3 p-4 rounded-xl bg-[#FBF9F5] border border-[#E8ECE6]">
              <div className="flex items-center gap-2 font-bold text-xs text-purple-900">
                <Scale size={16} />
                <span>Pengaduan Hukum ({complaints.length})</span>
              </div>
              <div className="space-y-2 text-xs">
                {complaints.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-white border border-[#E8ECE6]">
                    <div className="flex justify-between font-bold">
                      <span className="truncate max-w-[150px]">{c.title}</span>
                      <span className="text-purple-700">{c.status}</span>
                    </div>
                    <div className="text-[11px] text-[#70857A] mt-1 font-mono">{c.ticketNumber}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: KESEHATAN MENTAL */}
      {activeTab === "mentalhealth" && (
        <div className="space-y-5">
          {/* Hero Banner */}
          <div className="bg-[#315746] text-white rounded-3xl p-6 sm:p-8 shadow-sm">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#C6D9CD]">MENTAL HEALTH EDUCATION</span>
            <h2 className="text-2xl font-extrabold mt-1">Kesehatan Mental di Tempat Kerja</h2>
            <p className="text-xs text-[#D1DFD5] mt-2 leading-relaxed max-w-2xl">
              Kesehatan mental sama pentingnya dengan menjaga kesehatan fisik — terutama di tengah rutinitas dan tuntutan pekerjaan sehari-hari. Sebagai fondasi kesejahteraan emosional, psikologis, dan sosial, kesehatan mental menentukan cara kita berpikir, merasakan, dan menghadapi tekanan hidup.
            </p>
          </div>

          {/* 3 Tantangan Utama */}
          <div>
            <h3 className="text-sm font-extrabold text-[#1E392F] mb-3">Tantangan Kesehatan Mental di Dunia Kerja</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  emoji: "😓",
                  title: "Stres Kerja",
                  color: "border-amber-200 bg-amber-50",
                  titleColor: "text-amber-900",
                  desc: "Muncul ketika tuntutan pekerjaan melebihi kapasitas diri — akibat beban berlebih atau tenggat waktu yang ketat. Dapat dikelola melalui manajemen waktu dan komunikasi terbuka."
                },
                {
                  emoji: "🔥",
                  title: "Burnout",
                  color: "border-red-200 bg-red-50",
                  titleColor: "text-red-900",
                  desc: "Kondisi kelelahan berkepanjangan dengan sikap negatif pada pekerjaan dan penurunan produktivitas. Memerlukan pemulihan nyata dan keseimbangan hidup yang lebih sehat."
                },
                {
                  emoji: "😰",
                  title: "Kecemasan Karier",
                  color: "border-purple-200 bg-purple-50",
                  titleColor: "text-purple-900",
                  desc: "Tuntutan performa sering memicu kecemasan atas ketidakpastian karier. Jika berlangsung terus-menerus dan mengganggu aktivitas, perlu ditangani bersama tenaga profesional."
                },
              ].map((card, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${card.color} space-y-2 text-xs`}>
                  <div className="text-2xl">{card.emoji}</div>
                  <div className={`font-extrabold text-sm ${card.titleColor}`}>{card.title}</div>
                  <p className="leading-relaxed opacity-90 text-[#3D4A43]">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips Menjaga Kesejahteraan Emosional */}
          <div className="bg-white rounded-2xl border border-[#E8ECE6] shadow-sm overflow-hidden">
            <div className="bg-[#294D3F] px-5 py-3 flex items-center gap-2">
              <Heart size={15} className="text-[#C6D9CD]" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wide">Menjaga Kesejahteraan Emosional di Tempat Kerja</h4>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#3D5247]">
              {[
                {
                  icon: "🧘",
                  title: "Kelola Emosi dengan Sehat",
                  desc: "Saat menghadapi tekanan atau kritik, kenali sumbernya dan respons secara sehat — lewat jeda sejenak atau latihan pernapasan. Jangan menekan perasaan."
                },
                {
                  icon: "🌿",
                  title: "Self-Care Bukan Kemalasan",
                  desc: "Tidur cukup, menjaga nutrisi, menjalani hobi, dan beristirahat adalah cara penting menjaga energi agar tetap berfungsi optimal."
                },
                {
                  icon: "⚖️",
                  title: "Work-Life Balance",
                  desc: "Bagi waktu dan energi secara adil antara karier dan kehidupan pribadi untuk mencegah kelelahan berlebih dan menjaga kualitas hidup."
                },
                {
                  icon: "🤝",
                  title: "Lingkungan Kerja Suportif",
                  desc: "Hubungan kerja yang terbuka, bebas dari intimidasi dan diskriminasi, akan menciptakan rasa aman psikologis yang mendorong produktivitas."
                },
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
              <div className="font-extrabold text-sm mb-1">Hapus Stigma Kesehatan Mental</div>
              <p className="leading-relaxed">
                Apabila tekanan emosional mulai terasa berat dan mengganggu kehidupan sosial maupun pekerjaan, jangan ragu mencari bantuan profesional. Masalah mental bukanlah sebuah kelemahan — setiap individu berhak mendapatkan pemahaman, penghargaan atas pengalamannya, serta dukungan penuh tanpa dihakimi.
              </p>
            </div>
          </div>

          {/* CTA ke psikolog */}
          <div className="p-4 rounded-xl bg-[#294D3F] text-white flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold">Merasa butuh bantuan profesional?</p>
              <p className="text-[11px] text-[#C6D9CD] mt-0.5">Jadwalkan sesi konseling 1-on-1 privat bersama psikolog klinis berlisensi Wellfora.</p>
            </div>
            <button
              onClick={() => setActiveTab("counseling")}
              className="shrink-0 px-4 py-2 rounded-xl bg-white text-[#294D3F] text-xs font-bold hover:bg-[#EAF0EC] transition-all flex items-center gap-1.5"
            >
              <CalendarDays size={13} /> Booking Psikolog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
