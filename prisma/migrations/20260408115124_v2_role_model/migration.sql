-- CreateEnum
CREATE TYPE "GroupBookingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIAL', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BOOKING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BOOKING_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BOOKING_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BOOKING_SLOT_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'SLOT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'SLOT_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SLOT_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKTYPE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKTYPE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYER_UPDATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'USUARIO';
ALTER TYPE "UserRole" ADD VALUE 'EMPRESA';
ALTER TYPE "UserRole" ADD VALUE 'UABL';
ALTER TYPE "UserRole" ADD VALUE 'PROVEEDOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "employerId" TEXT,
ADD COLUMN     "isUablAdmin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "role" SET DEFAULT 'USUARIO';

-- CreateTable
CREATE TABLE "Employer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBooking" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "status" "GroupBookingStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassengerSlot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "groupBookingId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "representedCompany" TEXT NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassengerSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employer_companyId_idx" ON "Employer"("companyId");

-- CreateIndex
CREATE INDEX "Employer_companyId_isActive_idx" ON "Employer"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Employer_companyId_taxId_key" ON "Employer"("companyId", "taxId");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Department_companyId_isActive_idx" ON "Department"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_name_key" ON "Department"("companyId", "name");

-- CreateIndex
CREATE INDEX "WorkType_companyId_idx" ON "WorkType"("companyId");

-- CreateIndex
CREATE INDEX "WorkType_companyId_departmentId_idx" ON "WorkType"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "WorkType_companyId_isActive_idx" ON "WorkType"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkType_companyId_code_key" ON "WorkType"("companyId", "code");

-- CreateIndex
CREATE INDEX "GroupBooking_companyId_tripId_idx" ON "GroupBooking"("companyId", "tripId");

-- CreateIndex
CREATE INDEX "GroupBooking_employerId_status_idx" ON "GroupBooking"("employerId", "status");

-- CreateIndex
CREATE INDEX "GroupBooking_branchId_status_idx" ON "GroupBooking"("branchId", "status");

-- CreateIndex
CREATE INDEX "GroupBooking_bookedById_idx" ON "GroupBooking"("bookedById");

-- CreateIndex
CREATE INDEX "PassengerSlot_groupBookingId_idx" ON "PassengerSlot"("groupBookingId");

-- CreateIndex
CREATE INDEX "PassengerSlot_tripId_status_idx" ON "PassengerSlot"("tripId", "status");

-- CreateIndex
CREATE INDEX "PassengerSlot_departmentId_status_idx" ON "PassengerSlot"("departmentId", "status");

-- CreateIndex
CREATE INDEX "PassengerSlot_usuarioId_status_idx" ON "PassengerSlot"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "PassengerSlot_companyId_tripId_idx" ON "PassengerSlot"("companyId", "tripId");

-- CreateIndex
CREATE INDEX "PassengerSlot_branchId_status_idx" ON "PassengerSlot"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PassengerSlot_tripId_usuarioId_key" ON "PassengerSlot"("tripId", "usuarioId");

-- CreateIndex
CREATE INDEX "User_companyId_departmentId_idx" ON "User"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "User_companyId_employerId_idx" ON "User"("companyId", "employerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employer" ADD CONSTRAINT "Employer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkType" ADD CONSTRAINT "WorkType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkType" ADD CONSTRAINT "WorkType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerSlot" ADD CONSTRAINT "PassengerSlot_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
