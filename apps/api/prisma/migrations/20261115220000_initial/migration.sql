-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'HR_ADMIN', 'PSYCHOLOGIST', 'LEGAL_COUNSEL', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CUTI', 'SAKIT', 'DINAS');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LegalCategory" AS ENUM ('PELECEHAN_SEKSUAL', 'KEKERASAN_INTIMIDASI', 'PELANGGARAN_HUKUM_KERJA', 'DISKRIMINASI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'INVESTIGATION', 'MEDIATION', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "department" TEXT DEFAULT 'Operasional',
    "position" TEXT DEFAULT 'Karyawan',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "depression" INTEGER NOT NULL,
    "anxiety" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" INTEGER NOT NULL DEFAULT 1,
    "reason" VARCHAR(1000) NOT NULL,
    "attachmentUrl" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "hrNotes" VARCHAR(1000),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSlot" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationBooking" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes" VARCHAR(1000),
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "clinicalNotes" VARCHAR(2000),
    "actionPlan" VARCHAR(1000),
    "counselingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalComplaint" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "counselId" TEXT,
    "category" "LegalCategory" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(255),
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "evidenceInfo" VARCHAR(1000),
    "status" "LegalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "legalNotes" VARCHAR(2000),
    "investigationNotes" VARCHAR(2000),
    "mediationNotes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pseudonymId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "LoginOtp_userId_createdAt_idx" ON "LoginOtp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MoodEntry_userId_createdAt_idx" ON "MoodEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentResult_userId_createdAt_idx" ON "AssessmentResult"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_status_idx" ON "LeaveRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeSlot_psychologistId_isAvailable_idx" ON "PracticeSlot"("psychologistId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeSlot_psychologistId_day_time_key" ON "PracticeSlot"("psychologistId", "day", "time");

-- CreateIndex
CREATE INDEX "ConsultationBooking_psychologistId_scheduledAt_status_idx" ON "ConsultationBooking"("psychologistId", "scheduledAt", "status");

-- CreateIndex
CREATE INDEX "ConsultationBooking_employeeId_scheduledAt_idx" ON "ConsultationBooking"("employeeId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalComplaint_ticketNumber_key" ON "LegalComplaint"("ticketNumber");

-- CreateIndex
CREATE INDEX "LegalComplaint_userId_status_idx" ON "LegalComplaint"("userId", "status");

-- CreateIndex
CREATE INDEX "LegalComplaint_counselId_status_idx" ON "LegalComplaint"("counselId", "status");

-- CreateIndex
CREATE INDEX "LegalComplaint_status_createdAt_idx" ON "LegalComplaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");

-- AddForeignKey
ALTER TABLE "LoginOtp" ADD CONSTRAINT "LoginOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodEntry" ADD CONSTRAINT "MoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSlot" ADD CONSTRAINT "PracticeSlot_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationBooking" ADD CONSTRAINT "ConsultationBooking_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationBooking" ADD CONSTRAINT "ConsultationBooking_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalComplaint" ADD CONSTRAINT "LegalComplaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalComplaint" ADD CONSTRAINT "LegalComplaint_counselId_fkey" FOREIGN KEY ("counselId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

