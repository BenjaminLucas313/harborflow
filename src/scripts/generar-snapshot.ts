// =============================================================================
// Script: generar-snapshot
// =============================================================================
//
// Genera SnapshotMensual para todas las empresas activas.
// Útil para poblar snapshots históricos a partir de datos del seed.
//
// Uso:
//   npm run snapshot:generar               → mes anterior (default)
//   cross-env MES=3 ANIO=2026 npm run snapshot:generar  → período específico
//
// Env vars:
//   MES   — mes (1-12). Omitir o "anterior" para mes anterior.
//   ANIO  — año (2020+). Omitir para año actual o el del mes anterior.
// =============================================================================

import { prisma }                 from "@/lib/prisma";
import { generarSnapshotMensual } from "@/services/snapshot.service";

function argPrevMonth(): { mes: number; anio: number } {
  const now   = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
  const month = now.getUTCMonth(); // 0-indexed
  return month === 0
    ? { mes: 12, anio: now.getUTCFullYear() - 1 }
    : { mes: month, anio: now.getUTCFullYear() };
}

async function main() {
  const defaults = argPrevMonth();

  const mesEnv  = process.env["MES"];
  const anioEnv = process.env["ANIO"];

  const mesNum  = mesEnv && mesEnv !== "anterior" ? parseInt(mesEnv, 10) : NaN;
  const anioNum = anioEnv ? parseInt(anioEnv, 10) : NaN;

  const mes  = Number.isInteger(mesNum)  && mesNum  >= 1  && mesNum  <= 12 ? mesNum  : defaults.mes;
  const anio = Number.isInteger(anioNum) && anioNum >= 2020               ? anioNum : defaults.anio;

  const label = `${anio}-${String(mes).padStart(2, "0")}`;
  console.log(`[generar-snapshot] Período: ${label}`);

  const companies = await prisma.company.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (companies.length === 0) {
    console.log("[generar-snapshot] No hay empresas activas. Verificá el seed.");
    return;
  }

  console.log(`[generar-snapshot] ${companies.length} empresa(s) encontrada(s)\n`);

  let ok    = 0;
  let error = 0;

  for (const company of companies) {
    try {
      const snap = await generarSnapshotMensual(company.id, mes, anio);
      const ocup = (parseFloat(snap.promedioOcupacion.toString()) * 100).toFixed(1);
      console.log(`  ✓ ${company.name.padEnd(30)} viajes=${snap.totalViajes}  ocupación=${ocup}%  cancelaciones=${snap.cancelaciones}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${company.name}:`, err instanceof Error ? err.message : err);
      error++;
    }
  }

  console.log(`\n[generar-snapshot] Completado: ${ok} ok, ${error} errores`);
}

main()
  .catch((err) => {
    console.error("[generar-snapshot] Error fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
