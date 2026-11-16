import { Router } from "express";
import { BookingStatus, LegalStatus, LeaveStatus, LeaveType, Role } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { createPdf, formatPdfDate, formatPdfDateTime, sendPdf, type PdfCallout } from "../shared/pdf";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const leaveTypeLabels: Record<LeaveType, string> = {
  CUTI: "Cuti",
  SAKIT: "Izin sakit",
  DINAS: "Perjalanan dinas"
};

function officialReference(prefix: string, createdAt: Date, sourceId: string) {
  const serial = sourceId.replace(/[^A-Za-z0-9]/g, "").slice(-16).toUpperCase();
  return `${prefix}/${createdAt.getFullYear()}/${serial}`;
}

documentsRouter.get("/leaves/:id.pdf", async (req: AuthRequest, res, next) => {
  try {
    const role = req.auth!.role;
    if (role !== Role.EMPLOYEE && role !== Role.HR_ADMIN) {
      return res.status(403).json({ error: "Dokumen surat izin hanya tersedia untuk karyawan dan HRD." });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: String(req.params.id) },
      include: {
        user: { select: { id: true, name: true, department: true, position: true } }
      }
    });

    if (!leave || (role === Role.EMPLOYEE && leave.userId !== req.auth!.id)) {
      return res.status(404).json({ error: "Surat izin tidak ditemukan." });
    }
    if (leave.status !== LeaveStatus.APPROVED) {
      return res.status(409).json({ error: "PDF surat izin hanya tersedia setelah permohonan disetujui HRD." });
    }

    const pdf = await createPdf({
      title: "Surat Persetujuan Izin",
      reference: officialReference("WLF/HRD/IZN", leave.reviewedAt || leave.createdAt, leave.id),
      division: "HRD | HUMAN RESOURCES",
      status: "DISETUJUI",
      fields: [
        { label: "Nama karyawan", value: leave.user.name },
        { label: "Departemen", value: leave.user.department || "-" },
        { label: "Jabatan", value: leave.user.position || "-" },
        { label: "Jenis izin", value: leaveTypeLabels[leave.type] },
        { label: "Periode izin", value: `${formatPdfDate(leave.startDate)} sampai ${formatPdfDate(leave.endDate)}` },
        { label: "Jumlah hari kerja", value: `${leave.daysCount} hari` },
        { label: "Tanggal pengajuan", value: formatPdfDate(leave.createdAt) },
        { label: "Tanggal persetujuan", value: leave.reviewedAt ? formatPdfDateTime(leave.reviewedAt) : "-" }
      ],
      callouts: [
        { title: "ALASAN PERMOHONAN", value: leave.reason },
        { title: "CATATAN HRD", value: leave.hrNotes || "Tidak ada catatan tambahan dari HRD." }
      ],
      signerName: leave.reviewedBy || "Tim HRD Wellfora",
      signerTitle: "HRD | Pejabat Berwenang"
    });

    return sendPdf(res, `surat-izin-${leave.id}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
});

documentsRouter.get("/bookings/:id.pdf", async (req: AuthRequest, res, next) => {
  try {
    const role = req.auth!.role;
    if (role !== Role.EMPLOYEE && role !== Role.PSYCHOLOGIST) {
      return res.status(403).json({ error: "Dokumen konseling hanya tersedia untuk karyawan dan psikolog terkait." });
    }

    const booking = await prisma.consultationBooking.findUnique({
      where: { id: String(req.params.id) },
      include: {
        employee: { select: { id: true, name: true, department: true, position: true } },
        psychologist: { select: { id: true, name: true, department: true } }
      }
    });

    if (!booking ||
        (role === Role.EMPLOYEE && booking.employeeId !== req.auth!.id) ||
        (role === Role.PSYCHOLOGIST && booking.psychologistId !== req.auth!.id)) {
      return res.status(404).json({ error: "Janji konseling tidak ditemukan." });
    }
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.COMPLETED) {
      return res.status(409).json({ error: "PDF konseling tersedia setelah sesi dikonfirmasi." });
    }

    const callouts: PdfCallout[] = booking.status === BookingStatus.COMPLETED
      ? [
          { title: "CATATAN KLINIS", value: booking.clinicalNotes || "Tidak ada catatan klinis yang dicatat." },
          { title: "RENCANA TINDAK LANJUT", value: booking.actionPlan || "Tidak ada rencana tindak lanjut yang dicatat." }
        ]
      : [];
    const pdf = await createPdf({
      title: booking.status === BookingStatus.COMPLETED ? "Ringkasan Sesi Konseling" : "Konfirmasi Janji Konseling",
      reference: officialReference("WLF/EAP/KSL", booking.updatedAt, booking.id),
      division: "EMPLOYEE ASSISTANCE PROGRAM",
      status: booking.status === BookingStatus.COMPLETED ? "SELESAI" : "DISETUJUI",
      confidential: true,
      fields: [
        { label: "Nama karyawan", value: booking.employee.name },
        { label: "Departemen", value: booking.employee.department || "-" },
        { label: "Psikolog", value: booking.psychologist.name },
        { label: "Jadwal sesi", value: formatPdfDateTime(booking.scheduledAt) }
      ],
      callouts,
      signerName: booking.psychologist.name,
      signerTitle: "Psikolog Penanggung Jawab | EAP"
    });

    return sendPdf(res, `konseling-${booking.id}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
});

documentsRouter.get("/complaints/:id.pdf", async (req: AuthRequest, res, next) => {
  try {
    const role = req.auth!.role;
    if (role !== Role.EMPLOYEE && role !== Role.LEGAL_COUNSEL) {
      return res.status(403).json({ error: "Dokumen perkara hanya tersedia untuk karyawan pelapor dan tim hukum." });
    }

    const complaint = await prisma.legalComplaint.findUnique({
      where: { id: String(req.params.id) },
      include: {
        employee: { select: { id: true, name: true, department: true } },
        counsel: { select: { id: true, name: true } }
      }
    });

    if (!complaint || (role === Role.EMPLOYEE && complaint.userId !== req.auth!.id)) {
      return res.status(404).json({ error: "Berkas perkara tidak ditemukan." });
    }
    if (complaint.status !== LegalStatus.RESOLVED && complaint.status !== LegalStatus.CLOSED) {
      return res.status(409).json({ error: "PDF perkara tersedia setelah kasus diselesaikan atau ditutup." });
    }

    const callouts: PdfCallout[] = [
      { title: "URAIAN PENGADUAN", value: complaint.description }
    ];
    if (role === Role.LEGAL_COUNSEL) {
      callouts.push(
        { title: "TELAAH HUKUM", value: complaint.legalNotes || "Tidak ada telaah hukum yang dicatat pada berkas ini." },
        { title: "CATATAN INVESTIGASI", value: complaint.investigationNotes || "Tidak ada catatan investigasi yang dicatat pada berkas ini." },
        { title: "HASIL MEDIASI", value: complaint.mediationNotes || "Hasil mediasi belum dicatat." }
      );
    }

    const ticketSerial = complaint.ticketNumber.split("-").pop() || complaint.id;
    const pdf = await createPdf({
      title: "Berkas Pengaduan Hukum",
      reference: officialReference("WLF/LEGAL/PGD", complaint.updatedAt, ticketSerial),
      division: "LEGAL COUNSEL & COMPLIANCE",
      status: complaint.status === LegalStatus.RESOLVED ? "SELESAI" : "DITUTUP",
      confidential: true,
      fields: [
        { label: "Kategori kasus", value: complaint.category.replace(/_/g, " ") },
        { label: "Judul laporan", value: complaint.title },
        { label: "Tanggal kejadian", value: formatPdfDate(complaint.incidentDate) },
        { label: "Tanggal laporan", value: formatPdfDate(complaint.createdAt) },
        { label: "Lokasi", value: complaint.location || "-" },
        { label: "Pelapor", value: complaint.isAnonymous ? "Anonim" : complaint.employee.name }
      ],
      callouts,
      signerName: complaint.counsel?.name || "Tim Legal Wellfora",
      signerTitle: "Konselor Hukum | Legal Counsel"
    });

    return sendPdf(res, `berkas-hukum-${complaint.ticketNumber}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
});
