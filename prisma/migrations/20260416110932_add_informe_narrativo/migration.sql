-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INFORME_GENERADO';

-- CreateTable
CREATE TABLE "InformeNarrativo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InformeNarrativo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InformeNarrativo_companyId_anio_mes_idx" ON "InformeNarrativo"("companyId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "InformeNarrativo_companyId_mes_anio_key" ON "InformeNarrativo"("companyId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "InformeNarrativo" ADD CONSTRAINT "InformeNarrativo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
