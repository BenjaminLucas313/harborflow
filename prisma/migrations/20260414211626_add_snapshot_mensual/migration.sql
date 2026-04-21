-- CreateTable
CREATE TABLE "SnapshotMensual" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "totalViajes" INTEGER NOT NULL,
    "totalAsientosOcupados" DECIMAL(10,2) NOT NULL,
    "totalAsientosVacios" DECIMAL(10,2) NOT NULL,
    "promedioOcupacion" DECIMAL(5,4) NOT NULL,
    "distribucionDeptos" JSONB NOT NULL,
    "viajesPorDia" JSONB NOT NULL,
    "cancelaciones" INTEGER NOT NULL,
    "viajesBajaOcupacion" INTEGER NOT NULL,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SnapshotMensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SnapshotMensual_companyId_anio_mes_idx" ON "SnapshotMensual"("companyId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotMensual_companyId_mes_anio_key" ON "SnapshotMensual"("companyId", "mes", "anio");

-- AddForeignKey
ALTER TABLE "SnapshotMensual" ADD CONSTRAINT "SnapshotMensual_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
