import "dotenv/config";
import { PrismaClient, Role, LeaveType, LeaveStatus, BookingStatus, LegalCategory, LegalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seeding is forbidden in production.");
}
if (process.env.SEED_DEMO_DATA !== "true") {
  throw new Error("Set SEED_DEMO_DATA=true to seed an isolated development database.");
}
if (!process.env.SEED_DEMO_PASSWORD ||
    process.env.SEED_DEMO_PASSWORD.length < 12 ||
    Buffer.byteLength(process.env.SEED_DEMO_PASSWORD, "utf8") > 72) {
  throw new Error("Set SEED_DEMO_PASSWORD to a unique password of at least 12 characters.");
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Wellfora database...");
  const passwordHash = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD!, 12);

  // 1. Seed Users (5 Roles)
  const employee = await prisma.user.upsert({
    where: { email: "karyawan@wellfora.com" },
    update: {
      passwordHash,
      name: "Budi Santoso",
      role: Role.EMPLOYEE,
      department: "Teknologi Informasi",
      position: "Software Engineer",
      phone: "081234567890",
      isActive: true
    },
    create: {
      email: "karyawan@wellfora.com",
      name: "Budi Santoso",
      passwordHash,
      role: Role.EMPLOYEE,
      department: "Teknologi Informasi",
      position: "Software Engineer",
      phone: "081234567890",
      isActive: true
    }
  });

  const hrd = await prisma.user.upsert({
    where: { email: "hrd@wellfora.com" },
    update: {
      passwordHash,
      name: "Siti Rahmawati, S.Psi",
      role: Role.HR_ADMIN,
      department: "Human Resources",
      position: "HR People & Wellbeing Specialist",
      phone: "081298765432",
      isActive: true
    },
    create: {
      email: "hrd@wellfora.com",
      name: "Siti Rahmawati, S.Psi",
      passwordHash,
      role: Role.HR_ADMIN,
      department: "Human Resources",
      position: "HR People & Wellbeing Specialist",
      phone: "081298765432",
      isActive: true
    }
  });

  const psychologist = await prisma.user.upsert({
    where: { email: "psikolog@wellfora.com" },
    update: {
      passwordHash,
      name: "dr. Andini Putri, M.Psi., Psikolog",
      role: Role.PSYCHOLOGIST,
      department: "Layanan Konseling & EAP",
      position: "Lead Clinical Psychologist",
      phone: "081311223344",
      isActive: true
    },
    create: {
      email: "psikolog@wellfora.com",
      name: "dr. Andini Putri, M.Psi., Psikolog",
      passwordHash,
      role: Role.PSYCHOLOGIST,
      department: "Layanan Konseling & EAP",
      position: "Lead Clinical Psychologist",
      phone: "081311223344",
      isActive: true
    }
  });

  const legal = await prisma.user.upsert({
    where: { email: "legal@wellfora.com" },
    update: {
      passwordHash,
      name: "Fajar Prasetyo, S.H., M.H.",
      role: Role.LEGAL_COUNSEL,
      department: "Divisi Hukum & Kepatuhan",
      position: "Senior Legal Counsel & Compliance",
      phone: "081355667788",
      isActive: true
    },
    create: {
      email: "legal@wellfora.com",
      name: "Fajar Prasetyo, S.H., M.H.",
      passwordHash,
      role: Role.LEGAL_COUNSEL,
      department: "Divisi Hukum & Kepatuhan",
      position: "Senior Legal Counsel & Compliance",
      phone: "081355667788",
      isActive: true
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@wellfora.com" },
    update: {
      passwordHash,
      name: "Super Admin Wellfora",
      role: Role.SUPER_ADMIN,
      department: "IT & System Administration",
      position: "Chief Systems Administrator",
      phone: "081122334455",
      isActive: true
    },
    create: {
      email: "admin@wellfora.com",
      name: "Super Admin Wellfora",
      passwordHash,
      role: Role.SUPER_ADMIN,
      department: "IT & System Administration",
      position: "Chief Systems Administrator",
      phone: "081122334455",
      isActive: true
    }
  });

  // Example Resigned Employee (Inactive) for Superadmin deactivation testing
  await prisma.user.upsert({
    where: { email: "doni.resign@wellfora.com" },
    update: {
      passwordHash,
      name: "Doni Pratama (Resign)",
      role: Role.EMPLOYEE,
      department: "Marketing",
      position: "Ex-Content Writer",
      phone: "081999888777",
      isActive: false
    },
    create: {
      email: "doni.resign@wellfora.com",
      name: "Doni Pratama (Resign)",
      passwordHash,
      role: Role.EMPLOYEE,
      department: "Marketing",
      position: "Ex-Content Writer",
      phone: "081999888777",
      isActive: false
    }
  });

  // 2. Practice Slots for Psychologist
  await prisma.practiceSlot.deleteMany({ where: { psychologistId: psychologist.id } });
  await prisma.practiceSlot.createMany({
    data: [
      { psychologistId: psychologist.id, day: "Senin", time: "09:00 - 10:30 WIB", isAvailable: true },
      { psychologistId: psychologist.id, day: "Selasa", time: "13:30 - 15:00 WIB", isAvailable: true },
      { psychologistId: psychologist.id, day: "Rabu", time: "10:00 - 11:30 WIB", isAvailable: false },
      { psychologistId: psychologist.id, day: "Kamis", time: "14:00 - 15:30 WIB", isAvailable: true },
      { psychologistId: psychologist.id, day: "Jumat", time: "15:30 - 17:00 WIB", isAvailable: true }
    ]
  });

  // 3. Leave Requests
  await prisma.leaveRequest.deleteMany({ where: { userId: employee.id } });
  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: employee.id,
        type: LeaveType.CUTI,
        startDate: new Date(Date.now() + 3 * 86400000),
        endDate: new Date(Date.now() + 5 * 86400000),
        daysCount: 3,
        reason: "Cuti tahunan untuk pemulihan kesehatan mental dan istirahat keluarga.",
        status: LeaveStatus.APPROVED,
        hrNotes: "Disetujui. Pastikan handoff pekerjaan selesai sebelum cuti.",
        reviewedBy: hrd.name,
        reviewedAt: new Date()
      },
      {
        userId: employee.id,
        type: LeaveType.SAKIT,
        startDate: new Date(Date.now() - 7 * 86400000),
        endDate: new Date(Date.now() - 6 * 86400000),
        daysCount: 2,
        reason: "Gejala migrain berat dan kelelahan fisik. Surat dokter terlampir.",
        status: LeaveStatus.APPROVED,
        hrNotes: "Surat dokter valid. Istirahat yang cukup.",
        reviewedBy: hrd.name,
        reviewedAt: new Date(Date.now() - 6 * 86400000)
      },
      {
        userId: employee.id,
        type: LeaveType.DINAS,
        startDate: new Date(Date.now() + 10 * 86400000),
        endDate: new Date(Date.now() + 12 * 86400000),
        daysCount: 3,
        reason: "Dinas luar kota: Workshop Kesejahteraan & Produktivitas Kerja di Surabaya.",
        status: LeaveStatus.PENDING
      }
    ]
  });

  // 4. Consultation Bookings
  await prisma.consultationBooking.deleteMany({ where: { employeeId: employee.id } });
  await prisma.consultationBooking.createMany({
    data: [
      {
        employeeId: employee.id,
        psychologistId: psychologist.id,
        scheduledAt: new Date(Date.now() + 2 * 86400000),
        notes: "Sering merasa cemas dan overthinking terhadap deadline proyek.",
        status: BookingStatus.CONFIRMED
      },
      {
        employeeId: employee.id,
        psychologistId: psychologist.id,
        scheduledAt: new Date(Date.now() - 5 * 86400000),
        notes: "Konsultasi perdana mengenai stres kerja dan work-life imbalance.",
        status: BookingStatus.COMPLETED,
        clinicalNotes: "Klien mengalami gejala ansietas ringan hingga sedang akibat beban kerja tinggi. Respon fisiologis: ketegangan leher dan insomnia situasional.",
        actionPlan: "Latihan teknik relaksasi pernapasan 4-7-8, pembuatan batasan jam kerja digital (digital detox pkl 20:00), dan follow-up sesi 2 minggu.",
      }
    ]
  });

  // 5. Legal Complaints
  await prisma.legalComplaint.deleteMany({ where: { userId: employee.id } });
  await prisma.legalComplaint.createMany({
    data: [
      {
        ticketNumber: "WLF-LGL-2026-0001",
        userId: employee.id,
        counselId: legal.id,
        category: LegalCategory.PELANGGARAN_HUKUM_KERJA,
        title: "Pemaksaan Lembur di Luar Batas Regulasi Tanpa Kompensasi",
        description: "Instruksi kerja lembur berturut-turut melebihi 14 jam seminggu tanpa persetujuan tertulis dan tanpa perhitungan upah lembur resmi sesuai UU Ketenagakerjaan.",
        incidentDate: new Date(Date.now() - 10 * 86400000),
        location: "Kantor Pusat / Remote Slack",
        isAnonymous: false,
        evidenceInfo: "Tangkapan layar percakapan manajer, log jam kerja sistem (timesheet)",
        status: LegalStatus.INVESTIGATION,
        legalNotes: "Bukti awal memenuhi unsur telaah ketenagakerjaan pasal 78 UU Cipta Kerja. Sedang dijadwalkan wawancara klarifikasi bersama atasan terkait.",
        investigationNotes: "Pemeriksaan log timesheet mendapati anomali jam login > 50 jam dalam 1 minggu."
      },
      {
        ticketNumber: "WLF-LGL-2026-0002",
        userId: employee.id,
        counselId: legal.id,
        category: LegalCategory.PELECEHAN_SEKSUAL,
        title: "Laporan Tindakan Komentar Verbal Tidak Senonoh Secara Berulang",
        description: "Terdapat perlakuan verbal bernuansa pelecehan dari rekan divisi lain saat rapat offline dan pesan grup informal yang menciptakan lingkungan kerja tidak aman.",
        incidentDate: new Date(Date.now() - 3 * 86400000),
        location: "Ruang Rapat Lantai 3",
        isAnonymous: true,
        evidenceInfo: "Catatan saksi 2 rekan kerja dan rekaman pesan WhatsApp",
        status: LegalStatus.IN_REVIEW,
        legalNotes: "Laporan diterima secara rahasia. Prioritas perlindungan pelapor (whistleblower protection) diaktifkan."
      }
    ]
  });

  // 6. Mood & Assessment
  await prisma.moodEntry.deleteMany({ where: { userId: employee.id } });
  await prisma.moodEntry.createMany({
    data: [
      { userId: employee.id, mood: 4, note: "Hari ini cukup produktif dan tenang.", createdAt: new Date(Date.now() - 2 * 86400000) },
      { userId: employee.id, mood: 2, note: "Deadline padat, terasa agak cemas.", createdAt: new Date(Date.now() - 1 * 86400000) },
      { userId: employee.id, mood: 3, note: "Mencoba istirahat sejenak di sela tugas.", createdAt: new Date() }
    ]
  });

  await prisma.assessmentResult.deleteMany({ where: { userId: employee.id } });
  await prisma.assessmentResult.create({
    data: {
      userId: employee.id,
      depression: 6,
      anxiety: 10,
      stress: 12
    }
  });

  // 7. Forum posts
  await prisma.forumPost.deleteMany({ where: { userId: employee.id } });
  await prisma.forumPost.createMany({
    data: [
      {
        userId: employee.id,
        pseudonymId: "KawanTenang-1024",
        body: "Mengambil jeda 10 menit untuk jalan santai ternyata sangat membantu meredakan tegang setelah seharian menatap layar komputer."
      },
      {
        userId: employee.id,
        pseudonymId: "BintangPagi-4096",
        body: "Jangan ragu bicara ke psikolog atau HR kalau beban kerja sudah mulai mengganggu waktu tidur. Tubuh kita punya batas."
      }
    ]
  });

  console.log("Database seeded successfully with all 5 roles and sample data!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

