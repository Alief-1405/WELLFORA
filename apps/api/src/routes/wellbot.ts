import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { allowRoles, requireAuth } from "../middleware/auth";

export const atmaRouter = Router();
atmaRouter.use(requireAuth, allowRoles(Role.EMPLOYEE));

// Keywords for stress, fatigue, burnout, anxiety, or sleep disturbances
const STRESS_KEYWORDS = [
  "stres", "stress", "lelah", "capek", "burnout", "burn out", "cemas", "anxiety",
  "ansietas", "gangguan tidur", "insomnia", "susah tidur", "kurang tidur", "tidak bisa tidur",
  "depresi", "tertekan", "overthinking", "panik", "panic", "serangan panik", "beban kerja",
  "pusing", "tidak sanggup", "putus asa", "kelelahan", "lelah mental", "capek mental",
  "hampa", "menyerah", "ingin mati", "menyakiti diri", "overwhelmed", "tekanan batin",
  "kelelahan kronis", "sulit konsentrasi", "hilang motivasi"
];

// Keywords for legal issues, harassment, forced overtime, threats, and labor violations
const LEGAL_KEYWORDS = [
  "hukum", "masalah hukum", "pelecehan", "pelecehan seksual", "cabul", "diraba", "disentuh",
  "pesan senonoh", "foto senonoh", "lembur paksa", "lembur tanpa upah", "dipaksa lembur",
  "ancaman", "diancam", "ancaman pecat", "intimidasi", "kekerasan", "dipukul", "ditekan atasan",
  "pemerasan", "pungli", "tindak pidana", "diskriminasi", "dihina ras", "dihina agama",
  "ditahan ijazah", "upah tidak dibayar", "gaji dipotong", "eksploitasi", "pelecehan verbal",
  "pelecehan fisik", "surat peringatan sepihak", "sp tidak adil"
];

atmaRouter.post("/chat", async (req, res, next) => {
  try {
    const { message } = z.object({
      message: z.string().trim().min(1).max(2000)
    }).parse(req.body);

    const lower = message.toLowerCase();

    // 1. Check Legal, Harassment, Threat, or Labor Violation First
    const matchedLegal = LEGAL_KEYWORDS.find((kw) => lower.includes(kw));
    if (matchedLegal) {
      let specificDetail = "";
      if (lower.includes("pelecehan") || lower.includes("cabul") || lower.includes("diraba") || lower.includes("disentuh") || lower.includes("senonoh")) {
        specificDetail = "Wellfora memegang prinsip zero-tolerance terhadap segala bentuk pelecehan di lingkungan kerja. Kejadian ini bukan kesalahanmu dan kamu berhak atas rasa aman sepenuhnya.";
      } else if (lower.includes("lembur") || lower.includes("upah") || lower.includes("gaji") || lower.includes("ijazah")) {
        specificDetail = "Berdasarkan regulasi ketenagakerjaan resmi, pekerjaan lembur wajib atas persetujuan tertulis dan mendapatkan kompensasi upah yang sah. Penahanan dokumen atau lembur paksa merupakan pelanggaran hak kerja.";
      } else if (lower.includes("ancaman") || lower.includes("intimidasi") || lower.includes("kekerasan")) {
        specificDetail = "Ancaman, intimidasi atasan, maupun tindakan kekerasan fisik/verbal melanggar hukum dan kode etik profesi. Kami siap mendampingi perlindungan posisimu.";
      } else {
        specificDetail = "Setiap pekerja berhak atas perlindungan hukum, keadilan, dan lingkungan kerja yang bermartabat tanpa rasa takut.";
      }

      return res.json({
        reply: `Halo, terima kasih sudah berani terbuka kepada ATMA mengenai isu "${matchedLegal}". ${specificDetail} Kamu dapat mengajukan laporan resmi ke Tim Hukum Wellfora dengan opsi Whistleblower Anonim agar identitasmu tetap terlindungi secara penuh.`,
        category: "LEGAL_RISK",
        riskLevel: "HIGH",
        escalation: {
          type: "LEGAL_COMPLAINT",
          badge: "Hak Perlindungan Pekerja",
          title: "Eskalasi ke Tim Hukum & Advokat Wellfora",
          description: "Tim Advokat & Kepatuhan siap menelaah laporanmu secara rahasia dan independen dengan proteksi whistleblower.",
          actionText: "Buat Laporan Pengaduan Hukum",
          actionTab: "complaints"
        },
        disclaimer: "ATMA adalah asisten pendamping digital. Untuk situasi darurat atau bahaya fisik mendesak, segera hubungi pihak berwenang atau pihak keamanan kantor."
      });
    }

    // 2. Check Stress, Burnout, Fatigue, Anxiety, or Sleep Disturbances
    const matchedStress = STRESS_KEYWORDS.find((kw) => lower.includes(kw));
    if (matchedStress) {
      let stressContext = "";
      if (lower.includes("tidur") || lower.includes("insomnia")) {
        stressContext = "Gangguan tidur sering kali merupakan alarm dari tubuh dan pikiran bahwa ada beban emosional yang belum terurai. Pola istirahat yang terganggu akan berdampak langsung pada fokus dan staminamu.";
      } else if (lower.includes("burnout") || lower.includes("lelah") || lower.includes("capek")) {
        stressContext = "Kelelahan kerja yang menumpuk (burnout) bukan tanda kelemahan, melainkan sinyal bahwa kapasitas energimu sudah terkuras dan membutuhkan jeda pemulihan yang nyata.";
      } else if (lower.includes("cemas") || lower.includes("anxiety") || lower.includes("panik") || lower.includes("overthinking")) {
        stressContext = "Kecemasan dan overthinking sering kali membuat segalanya terasa mendesak dan menakutkan. Mari tarik napas perlahan dan lepaskan ketegangan di bahumu sejenak.";
      } else {
        stressContext = "Beban yang sedang kamu pikul saat ini terasa sangat nyata dan berat. Sangat wajar jika kamu merasa kewalahan.";
      }

      return res.json({
        reply: `ATMA mendengar apa yang kamu rasakan mengenai kondisi "${matchedStress}". ${stressContext} Kamu tidak harus menanggung semuanya sendirian. Melalui program EAP Wellfora, kamu berhak mendapatkan sesi konseling 1-on-1 privat bersama psikolog klinis berlisensi untuk memulihkan energimu.`,
        category: "SEVERE_STRESS",
        riskLevel: "HIGH",
        escalation: {
          type: "BOOK_PSYCHOLOGIST",
          badge: "Rekomendasi Pemulihan EAP",
          title: "Jadwalkan Konseling Privat Bersama Psikolog",
          description: "Sesi konseling 1-on-1 bersifat 100% rahasia medis dan dirancang untuk membantu mengurai stres kerja secara terarah.",
          actionText: "Booking Psikolog Sekarang",
          actionTab: "counseling"
        },
        disclaimer: "ATMA adalah asisten refleksi awal, bukan pengganti psikolog klinis profesional atau penanganan krisis darurat."
      });
    }

    // 3. General Interactive & Contextual Reflection
    const contextualMessage = message.length > 180 ? `${message.slice(0, 177)}...` : message;
    const chosenReply = lower.includes("?")
      ? `Terima kasih sudah bertanya kepada ATMA. Kamu bertanya, “${contextualMessage}”. Aku bisa membantu memikirkan langkah awal, meski bukan pengganti saran profesional. Bagian mana yang paling ingin kamu pahami atau tindak lanjuti?`
      : `Terima kasih sudah bercerita kepada ATMA. Aku menangkap bahwa kamu sedang membicarakan “${contextualMessage}”. Perasaan dan pengalamanmu layak didengarkan tanpa dihakimi. Apa bagian yang paling ingin kamu urai lebih dulu?`;

    return res.json({
      reply: chosenReply,
      category: "GENERAL_WELLBEING",
      riskLevel: "LOW",
      escalation: null,
      disclaimer: "ATMA (Asisten Teman Mental Anda) adalah ruang curhat aman 24/7 untuk refleksi diri dan kesejahteraan pekerja."
    });
  } catch (error) {
    next(error);
  }
});
