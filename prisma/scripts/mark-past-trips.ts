/**
 * Data Migration Script: Mark Past and Cancelled Trips
 *
 * Sets the `viajeStatus` field on existing Trip records based on their
 * current operational `status`:
 *
 *   TripStatus.DEPARTED | COMPLETED  → ViajeStatus.PASADO
 *   TripStatus.CANCELLED            → ViajeStatus.CANCELADO
 *   All other statuses              → ViajeStatus.ACTIVO (already the default, skipped)
 *
 * This script is idempotent: re-running it produces the same result.
 * It is safe to run against live data — it only updates `viajeStatus`
 * and does not modify any other fields.
 *
 * Usage:
 *   DRY_RUN=true  npx tsx prisma/scripts/mark-past-trips.ts   (inspect counts, no changes)
 *   DRY_RUN=false npx tsx prisma/scripts/mark-past-trips.ts   (apply changes)
 *
 * Run ONCE after deploying the add_liquidacion_schema migration.
 * Review DRY_RUN output carefully before setting DRY_RUN=false.
 */

import "dotenv/config";
import { PrismaClient, TripStatus, ViajeStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN !== "false";

// Operational statuses that map to ViajeStatus.PASADO.
const PASADO_STATUSES: TripStatus[] = [TripStatus.DEPARTED, TripStatus.COMPLETED];

// Operational statuses that map to ViajeStatus.CANCELADO.
const CANCELADO_STATUSES: TripStatus[] = [TripStatus.CANCELLED];

async function main() {
  console.log("\n=== mark-past-trips: ViajeStatus backfill ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes applied)" : "LIVE — changes will be applied"}\n`);

  // ---------------------------------------------------------------------------
  // 1. Count trips that need updating.
  // ---------------------------------------------------------------------------
  const [countPasado, countCancelado, countAlreadyPasado, countAlreadyCancelado] =
    await Promise.all([
      prisma.trip.count({
        where: {
          status: { in: PASADO_STATUSES },
          viajeStatus: { not: ViajeStatus.PASADO },
        },
      }),
      prisma.trip.count({
        where: {
          status: { in: CANCELADO_STATUSES },
          viajeStatus: { not: ViajeStatus.CANCELADO },
        },
      }),
      prisma.trip.count({ where: { viajeStatus: ViajeStatus.PASADO } }),
      prisma.trip.count({ where: { viajeStatus: ViajeStatus.CANCELADO } }),
    ]);

  console.log("Trips requiring update:");
  console.log(`  → PASADO   (DEPARTED/COMPLETED but not yet PASADO) : ${countPasado}`);
  console.log(`  → CANCELADO (CANCELLED but not yet CANCELADO)      : ${countCancelado}`);
  console.log("\nTrips already at target state (will be skipped):");
  console.log(`  Already PASADO   : ${countAlreadyPasado}`);
  console.log(`  Already CANCELADO: ${countAlreadyCancelado}`);

  if (countPasado === 0 && countCancelado === 0) {
    console.log("\nNothing to update. Schema is already consistent.");
    return;
  }

  if (DRY_RUN) {
    console.log(
      "\n[DRY RUN] No changes applied.",
      "\nSet DRY_RUN=false to apply:",
      "\n  DRY_RUN=false npx tsx prisma/scripts/mark-past-trips.ts"
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // 2. Mark DEPARTED / COMPLETED trips as PASADO.
  // ---------------------------------------------------------------------------
  if (countPasado > 0) {
    const result = await prisma.trip.updateMany({
      where: {
        status: { in: PASADO_STATUSES },
        viajeStatus: { not: ViajeStatus.PASADO },
      },
      data: { viajeStatus: ViajeStatus.PASADO },
    });
    console.log(`\n✓ Marked ${result.count} trip(s) → PASADO`);
  }

  // ---------------------------------------------------------------------------
  // 3. Mark CANCELLED trips as CANCELADO.
  // ---------------------------------------------------------------------------
  if (countCancelado > 0) {
    const result = await prisma.trip.updateMany({
      where: {
        status: { in: CANCELADO_STATUSES },
        viajeStatus: { not: ViajeStatus.CANCELADO },
      },
      data: { viajeStatus: ViajeStatus.CANCELADO },
    });
    console.log(`✓ Marked ${result.count} trip(s) → CANCELADO`);
  }

  // ---------------------------------------------------------------------------
  // 4. Verify final state.
  // ---------------------------------------------------------------------------
  const [finalPasado, finalCancelado, finalActivo] = await Promise.all([
    prisma.trip.count({ where: { viajeStatus: ViajeStatus.PASADO } }),
    prisma.trip.count({ where: { viajeStatus: ViajeStatus.CANCELADO } }),
    prisma.trip.count({ where: { viajeStatus: ViajeStatus.ACTIVO } }),
  ]);

  console.log("\n--- Final viajeStatus distribution ---");
  console.log(`  ACTIVO   : ${finalActivo}`);
  console.log(`  PASADO   : ${finalPasado}`);
  console.log(`  CANCELADO: ${finalCancelado}`);
  console.log("\n✓ Migration complete.");
}

main()
  .catch((err) => {
    console.error("\nMigration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
