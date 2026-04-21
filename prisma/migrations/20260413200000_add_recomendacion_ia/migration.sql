-- CreateEnum
CREATE TYPE "PrioridadIA" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoRecomendacion" AS ENUM ('ACTIVA', 'IMPLEMENTADA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "RecomendacionIA" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ahorroEstimadoAsientos" INTEGER NOT NULL,
    "prioridad" "PrioridadIA" NOT NULL,
    "estado" "EstadoRecomendacion" NOT NULL DEFAULT 'ACTIVA',
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecomendacionIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecomendacionIA_companyId_estado_idx" ON "RecomendacionIA"("companyId", "estado");

-- CreateIndex
CREATE INDEX "RecomendacionIA_companyId_anio_mes_idx" ON "RecomendacionIA"("companyId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "RecomendacionIA" ADD CONSTRAINT "RecomendacionIA_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
