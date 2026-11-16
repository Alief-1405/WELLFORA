CREATE TYPE "EmployeeAccountRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "EmployeeAccountRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "notes" VARCHAR(1000),
    "status" "EmployeeAccountRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" VARCHAR(1000),
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAccountRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeAccountRequest_createdUserId_key" ON "EmployeeAccountRequest"("createdUserId");
CREATE INDEX "EmployeeAccountRequest_requestedById_status_createdAt_idx" ON "EmployeeAccountRequest"("requestedById", "status", "createdAt");
CREATE INDEX "EmployeeAccountRequest_status_createdAt_idx" ON "EmployeeAccountRequest"("status", "createdAt");
CREATE INDEX "EmployeeAccountRequest_phone_status_idx" ON "EmployeeAccountRequest"("phone", "status");

ALTER TABLE "EmployeeAccountRequest" ADD CONSTRAINT "EmployeeAccountRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAccountRequest" ADD CONSTRAINT "EmployeeAccountRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeAccountRequest" ADD CONSTRAINT "EmployeeAccountRequest_createdUserId_fkey"
    FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
