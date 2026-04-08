-- =============================================================================
-- HarborFlow Migration: Restructure User Roles (V1 → V2)
-- =============================================================================
--
-- This migration replaces the three V1 roles (PASSENGER, OPERATOR, ADMIN)
-- with four V2 roles (EMPLOYEE, COMPANY_REP, UABL_STAFF, PROVIDER) and
-- introduces the new allocation-based booking paradigm.
--
-- IMPORTANT: The UPDATE statements (data migration) MUST run before the
-- ALTER TABLE statements that change the enum type. The order below is correct.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Create new enum types
-- (PostgreSQL does not support renaming enum values in place)
-- ----------------------------------------------------------------------------

CREATE TYPE "UserRole_new" AS ENUM ('EMPLOYEE', 'COMPANY_REP', 'UABL_STAFF', 'PROVIDER');
CREATE TYPE "SeatRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_CONFIRMED', 'FULLY_CONFIRMED', 'CANCELLED');

-- ----------------------------------------------------------------------------
-- STEP 2: Add new AuditAction enum values
-- ----------------------------------------------------------------------------

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALLOCATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALLOCATION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALLOCATION_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SEAT_REQUEST_ADDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SEAT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SEAT_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SEAT_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VESSEL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VESSEL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PORT_OPENED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PORT_CLOSED';

-- ----------------------------------------------------------------------------
-- STEP 3: Data migration — update existing User roles BEFORE altering type
-- PASSENGER → EMPLOYEE  (passive recipients, view-only)
-- OPERATOR  → UABL_STAFF (will need departmentId assigned manually after)
-- ADMIN     → PROVIDER   (fleet and schedule management)
-- ----------------------------------------------------------------------------

UPDATE "User" SET role = 'EMPLOYEE'   WHERE role = 'PASSENGER';
UPDATE "User" SET role = 'UABL_STAFF' WHERE role = 'OPERATOR';
UPDATE "User" SET role = 'PROVIDER'   WHERE role = 'ADMIN';

-- ----------------------------------------------------------------------------
-- STEP 4: Alter User.role column to use new enum type
-- ----------------------------------------------------------------------------

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING ("role"::text::"UserRole_new");

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';

-- ----------------------------------------------------------------------------
-- STEP 5: Drop old UserRole enum, rename new one
-- ----------------------------------------------------------------------------

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- ----------------------------------------------------------------------------
-- STEP 6: Add new columns to User
-- ----------------------------------------------------------------------------

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

-- ----------------------------------------------------------------------------
-- STEP 7: Drop legacy partial unique indexes (V1 single-active-reservation)
-- (these may not exist if the DB was never seeded with the raw migration SQL)
-- ----------------------------------------------------------------------------

DROP INDEX IF EXISTS reservation_one_active_per_user;
DROP INDEX IF EXISTS waitlist_one_waiting_per_user_per_trip;

-- ----------------------------------------------------------------------------
-- STEP 8: Create Department table
-- ----------------------------------------------------------------------------

CREATE TABLE "Department" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- ----------------------------------------------------------------------------
-- STEP 9: Create WorkType table
-- ----------------------------------------------------------------------------

CREATE TABLE "WorkType" (
  "id"           TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkType_departmentId_idx"          ON "WorkType"("departmentId");
CREATE INDEX "WorkType_departmentId_isActive_idx" ON "WorkType"("departmentId", "isActive");

ALTER TABLE "WorkType"
  ADD CONSTRAINT "WorkType_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 10: Add departmentId foreign key to User
-- ----------------------------------------------------------------------------

ALTER TABLE "User"
  ADD CONSTRAINT "User_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_companyId_role_isActive_idx" ON "User"("companyId", "role", "isActive");

-- ----------------------------------------------------------------------------
-- STEP 11: Create TripAllocation table
-- ----------------------------------------------------------------------------

CREATE TABLE "TripAllocation" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "tripId"        TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status"        "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripAllocation_tripId_status_idx"    ON "TripAllocation"("tripId", "status");
CREATE INDEX "TripAllocation_companyId_status_idx" ON "TripAllocation"("companyId", "status");
CREATE INDEX "TripAllocation_requestedById_idx"    ON "TripAllocation"("requestedById");

ALTER TABLE "TripAllocation"
  ADD CONSTRAINT "TripAllocation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TripAllocation"
  ADD CONSTRAINT "TripAllocation_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TripAllocation"
  ADD CONSTRAINT "TripAllocation_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 12: Create SeatRequest table
-- ----------------------------------------------------------------------------

CREATE TABLE "SeatRequest" (
  "id"            TEXT NOT NULL,
  "allocationId"  TEXT NOT NULL,
  "employeeId"    TEXT NOT NULL,
  "workTypeId"    TEXT NOT NULL,
  "departmentId"  TEXT NOT NULL,
  "status"        "SeatRequestStatus" NOT NULL DEFAULT 'PENDING',
  "confirmedById" TEXT,
  "confirmedAt"   TIMESTAMP(3),
  "rejectionNote" TEXT,
  "notifiedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeatRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SeatRequest_allocationId_status_idx" ON "SeatRequest"("allocationId", "status");
CREATE INDEX "SeatRequest_employeeId_status_idx"   ON "SeatRequest"("employeeId", "status");
CREATE INDEX "SeatRequest_departmentId_status_idx" ON "SeatRequest"("departmentId", "status");
CREATE INDEX "SeatRequest_workTypeId_idx"          ON "SeatRequest"("workTypeId");

ALTER TABLE "SeatRequest"
  ADD CONSTRAINT "SeatRequest_allocationId_fkey"
  FOREIGN KEY ("allocationId") REFERENCES "TripAllocation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeatRequest"
  ADD CONSTRAINT "SeatRequest_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeatRequest"
  ADD CONSTRAINT "SeatRequest_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeatRequest"
  ADD CONSTRAINT "SeatRequest_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeatRequest"
  ADD CONSTRAINT "SeatRequest_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 13: Create Notification table
-- ----------------------------------------------------------------------------

CREATE TABLE "Notification" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "payload"   JSONB NOT NULL,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_idx"           ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_desc_idx"   ON "Notification"("userId", "createdAt" DESC);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Migration complete.
-- Next steps after applying:
--   1. Seed Department and WorkType records (prisma/seed.ts)
--   2. Rotate AUTH_SECRET in .env to force all existing JWTs to expire
--      (users with old role strings in JWT will get redirected to /login)
--   3. Assign departmentId to migrated UABL_STAFF users manually or via
--      the admin seed script.
-- =============================================================================
