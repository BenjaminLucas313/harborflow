-- CreateEnum
CREATE TYPE "ViajeStatus" AS ENUM ('ACTIVO', 'PASADO', 'CANCELADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LIQUIDACION_CALCULADA';
ALTER TYPE "AuditAction" ADD VALUE 'LIQUIDACION_RECALCULADA';
ALTER TYPE "AuditAction" ADD VALUE 'VIAJE_MARCADO_PASADO';

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "emailContacto" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "departamentoId" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "liquidacionCalculada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viajeStatus" "ViajeStatus" NOT NULL DEFAULT 'ACTIVO';

-- CreateTable
CREATE TABLE "AsientoLiquidacion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "asientosReservados" INTEGER NOT NULL,
    "fraccionVacios" DECIMAL(8,4) NOT NULL,
    "totalAsientos" DECIMAL(8,4) NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsientoLiquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsientoLiquidacion_companyId_anio_mes_idx" ON "AsientoLiquidacion"("companyId", "anio", "mes");

-- CreateIndex
CREATE INDEX "AsientoLiquidacion_branchId_anio_mes_idx" ON "AsientoLiquidacion"("branchId", "anio", "mes");

-- CreateIndex
CREATE INDEX "AsientoLiquidacion_departamentoId_anio_mes_idx" ON "AsientoLiquidacion"("departamentoId", "anio", "mes");

-- CreateIndex
CREATE INDEX "AsientoLiquidacion_viajeId_idx" ON "AsientoLiquidacion"("viajeId");

-- CreateIndex
CREATE UNIQUE INDEX "AsientoLiquidacion_viajeId_departamentoId_key" ON "AsientoLiquidacion"("viajeId", "departamentoId");

-- CreateIndex
CREATE INDEX "Reservation_departamentoId_idx" ON "Reservation"("departamentoId");

-- CreateIndex
CREATE INDEX "Trip_companyId_viajeStatus_liquidacionCalculada_idx" ON "Trip"("companyId", "viajeStatus", "liquidacionCalculada");

-- AddForeignKey
ALTER TABLE "AsientoLiquidacion" ADD CONSTRAINT "AsientoLiquidacion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoLiquidacion" ADD CONSTRAINT "AsientoLiquidacion_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoLiquidacion" ADD CONSTRAINT "AsientoLiquidacion_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoLiquidacion" ADD CONSTRAINT "AsientoLiquidacion_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
