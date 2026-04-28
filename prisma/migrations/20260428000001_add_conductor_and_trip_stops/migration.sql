-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONDUCTOR';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CONDUCTOR_CHECKIN';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SALIDA_CONFIRMADA';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_MENSUAL_ENVIADO';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CIERRE_MENSUAL_COMPLETADO';

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Trip"
ADD COLUMN "salidaConfirmada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salidaConfirmadaAt" TIMESTAMP(3),
ADD COLUMN "salidaConfirmadaBy" TEXT;

-- CreateTable
CREATE TABLE "ConductorCheckin" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conductorId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConductorCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConductorCheckin_tripId_userId_key" ON "ConductorCheckin"("tripId", "userId");

-- CreateIndex
CREATE INDEX "ConductorCheckin_tripId_idx" ON "ConductorCheckin"("tripId");

-- CreateIndex
CREATE INDEX "ConductorCheckin_companyId_tripId_idx" ON "ConductorCheckin"("companyId", "tripId");

-- CreateIndex
CREATE INDEX "TripStop_tripId_order_idx" ON "TripStop"("tripId", "order");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorCheckin" ADD CONSTRAINT "ConductorCheckin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorCheckin" ADD CONSTRAINT "ConductorCheckin_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorCheckin" ADD CONSTRAINT "ConductorCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorCheckin" ADD CONSTRAINT "ConductorCheckin_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
