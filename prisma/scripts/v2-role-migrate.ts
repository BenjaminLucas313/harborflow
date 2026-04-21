/**
 * V2 Role Migration Script
 *
 * Migrates the existing V1 role model (PASSENGER / OPERATOR / ADMIN) to V2
 * (USUARIO / PROVEEDOR / UABL).
 *
 * Run with:
 *   npx tsx prisma/scripts/v2-role-migrate.ts
 *
 * IMPORTANT:
 *   - Run this ONCE after deploying the V2 schema migration.
 *   - The script is idempotent: re-running it is safe.
 *   - ADMIN users are NOT migrated automatically — they must be manually
 *     assigned the UABL role with isUablAdmin=true by a database admin.
 *   - Review the DRY_RUN output carefully before setting DRY_RUN=false.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Set to false to actually apply changes.
const DRY_RUN = process.env.DRY_RUN !== "false";

async function main() {
  console.log(`\n=== V2 Role Migration ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE — changes will be applied"}\n`);

  // -------------------------------------------------------------------------
  // 1. Count affected users before migration.
  // -------------------------------------------------------------------------
  const [passengers, operators, admins] = await Promise.all([
    prisma.user.count({ where: { role: "PASSENGER" } }),
    prisma.user.count({ where: { role: "OPERATOR" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  console.log(`Users to migrate:`);
  console.log(`  PASSENGER → USUARIO : ${passengers}`);
  console.log(`  OPERATOR  → PROVEEDOR: ${operators}`);
  console.log(`  ADMIN     → (manual) : ${admins}`);

  if (!DRY_RUN) {
    // -----------------------------------------------------------------------
    // 2. Migrate PASSENGER → USUARIO
    // -----------------------------------------------------------------------
    if (passengers > 0) {
      const result = await prisma.user.updateMany({
        where: { role: "PASSENGER" },
        data:  { role: "USUARIO" },
      });
      console.log(`\n✓ Migrated ${result.count} PASSENGER → USUARIO`);
    }

    // -----------------------------------------------------------------------
    // 3. Migrate OPERATOR → PROVEEDOR
    // -----------------------------------------------------------------------
    if (operators > 0) {
      const result = await prisma.user.updateMany({
        where: { role: "OPERATOR" },
        data:  { role: "PROVEEDOR" },
      });
      console.log(`✓ Migrated ${result.count} OPERATOR → PROVEEDOR`);
    }

    // -----------------------------------------------------------------------
    // 4. Archive legacy Reservation records.
    //    CONFIRMED / WAITLISTED / CHECKED_IN → CANCELLED
    //    (these statuses can't be honoured in V2's slot-based model)
    // -----------------------------------------------------------------------
    const archivedReservations = await prisma.reservation.updateMany({
      where:  { status: { in: ["CONFIRMED", "WAITLISTED", "CHECKED_IN"] } },
      data:   { status: "CANCELLED" },
    });
    console.log(`✓ Archived ${archivedReservations.count} active Reservation records → CANCELLED`);

    // -----------------------------------------------------------------------
    // 5. Archive legacy WaitlistEntry records.
    // -----------------------------------------------------------------------
    const archivedWaitlist = await prisma.waitlistEntry.updateMany({
      where: { status: "WAITING" },
      data:  { status: "EXPIRED" },
    });
    console.log(`✓ Archived ${archivedWaitlist.count} WaitlistEntry records → EXPIRED`);

    console.log(`\n✓ Migration complete.`);
  } else {
    console.log(`\n[DRY RUN] No changes applied.`);
    console.log(`Set DRY_RUN=false to apply: DRY_RUN=false npx tsx prisma/scripts/v2-role-migrate.ts`);
  }

  // -------------------------------------------------------------------------
  // 6. Always print ADMIN users that require manual handling.
  // -------------------------------------------------------------------------
  if (admins > 0) {
    const adminUsers = await prisma.user.findMany({
      where:  { role: "ADMIN" },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    console.log(`\n⚠️  ADMIN users require MANUAL migration:`);
    console.log(`   These users must be assigned role=UABL + isUablAdmin=true via SQL or Prisma Studio.\n`);
    adminUsers.forEach((u) => {
      console.log(`   - ${u.firstName} ${u.lastName} <${u.email}> (id: ${u.id})`);
    });

    console.log(`\n   Example SQL:`);
    console.log(`   UPDATE "User" SET role = 'UABL', "isUablAdmin" = true WHERE role = 'ADMIN';`);
  }
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
