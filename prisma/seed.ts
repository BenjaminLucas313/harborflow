// =============================================================================
// HarborFlow — Development Seed
// =============================================================================
//
// Creates a minimal but complete dataset for end-to-end testing:
//   - 1 Company  (slug: "harbor-norte")
//   - 1 Branch   (Porto Norte)
//   - 1 Boat     (capacity: 2 — intentionally small to force waitlist testing)
//   - 1 Driver
//   - 3 Users:   passenger / operator (branch-scoped) / admin (branch-scoped)
//   - 3 Trips:   future dates, capacity 2, waitlist enabled
//
// IDEMPOTENT: uses upsert on every record — safe to re-run.
//
// Run:
//   npx prisma db seed
//   — OR —
//   npx tsx prisma/seed.ts
//
// =============================================================================

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Credentials (change before any non-local use)
// ---------------------------------------------------------------------------

const COMPANY_SLUG = "harbor-norte";

const USERS = {
  passenger: {
    email: "passenger@harbor-norte.dev",
    password: "passenger123",
    firstName: "Ana",
    lastName: "Costa",
    role: "PASSENGER" as const,
  },
  operator: {
    email: "operator@harbor-norte.dev",
    password: "operator123",
    firstName: "Carlos",
    lastName: "Mendes",
    role: "OPERATOR" as const,
  },
  admin: {
    email: "admin@harbor-norte.dev",
    password: "admin123",
    firstName: "Sofia",
    lastName: "Alves",
    role: "ADMIN" as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a Date set to HH:MM UTC on a day offset from today. */
function futureDate(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding HarborFlow development data…\n");

  // ── 1. Company ──────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { slug: COMPANY_SLUG },
    update: {},
    create: {
      name: "Harbor Norte",
      slug: COMPANY_SLUG,
      isActive: true,
    },
  });
  console.log(`✓ Company   : ${company.name} (slug: ${company.slug})`);

  // ── 2. Branch ───────────────────────────────────────────────────────────
  // Upsert by name+companyId (no unique constraint exists on name alone,
  // so we use findFirst + create to stay idempotent).
  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, name: "Porto Norte" },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: "Porto Norte",
        address: "Cais 1, Porto Norte",
        isActive: true,
      },
    });
  }
  console.log(`✓ Branch    : ${branch.name} (id: ${branch.id})`);

  // ── 3. Boat ─────────────────────────────────────────────────────────────
  // Capacity = 2 → trips will fill after 2 bookings, enabling waitlist tests.
  let boat = await prisma.boat.findFirst({
    where: { companyId: company.id, branchId: branch.id, name: "Barco Alpha" },
  });
  if (!boat) {
    boat = await prisma.boat.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: "Barco Alpha",
        capacity: 2,
        description: "Embarcação de teste — capacidade intencional de 2 lugares.",
        isActive: true,
      },
    });
  }
  console.log(`✓ Boat      : ${boat.name} (capacity: ${boat.capacity})`);

  // ── 4. Driver ───────────────────────────────────────────────────────────
  let driver = await prisma.driver.findFirst({
    where: { companyId: company.id, branchId: branch.id, firstName: "Rui", lastName: "Santos" },
  });
  if (!driver) {
    driver = await prisma.driver.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        firstName: "Rui",
        lastName: "Santos",
        licenseNumber: "NAV-DEV-001",
        phone: "+351 900 000 001",
        isActive: true,
      },
    });
  }
  console.log(`✓ Driver    : ${driver.firstName} ${driver.lastName}`);

  // ── 5. Users ─────────────────────────────────────────────────────────────
  // bcrypt cost 10 is fine for dev (faster than the production 12).
  const ROUNDS = 10;

  // PASSENGER — no branchId (passengers are company-scoped only).
  const passengerHash = await bcrypt.hash(USERS.passenger.password, ROUNDS);
  const passenger = await prisma.user.upsert({
    where: {
      companyId_email: { companyId: company.id, email: USERS.passenger.email },
    },
    update: {},
    create: {
      companyId: company.id,
      email: USERS.passenger.email,
      passwordHash: passengerHash,
      firstName: USERS.passenger.firstName,
      lastName: USERS.passenger.lastName,
      role: USERS.passenger.role,
      isActive: true,
    },
  });
  console.log(`✓ Passenger : ${passenger.email} / ${USERS.passenger.password}`);

  // OPERATOR — must have branchId so the operator trips page shows data.
  const operatorHash = await bcrypt.hash(USERS.operator.password, ROUNDS);
  const operator = await prisma.user.upsert({
    where: {
      companyId_email: { companyId: company.id, email: USERS.operator.email },
    },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      email: USERS.operator.email,
      passwordHash: operatorHash,
      firstName: USERS.operator.firstName,
      lastName: USERS.operator.lastName,
      role: USERS.operator.role,
      isActive: true,
    },
  });
  console.log(`✓ Operator  : ${operator.email} / ${USERS.operator.password}`);

  // ADMIN — branch-scoped so /admin/trips renders (same guard as operator page).
  const adminHash = await bcrypt.hash(USERS.admin.password, ROUNDS);
  const admin = await prisma.user.upsert({
    where: {
      companyId_email: { companyId: company.id, email: USERS.admin.email },
    },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      email: USERS.admin.email,
      passwordHash: adminHash,
      firstName: USERS.admin.firstName,
      lastName: USERS.admin.lastName,
      role: USERS.admin.role,
      isActive: true,
    },
  });
  console.log(`✓ Admin     : ${admin.email} / ${USERS.admin.password}`);

  // ── 6. Trips ─────────────────────────────────────────────────────────────
  // capacity is snapshotted from boat (design principle — see schema comments).
  // We set it directly here as the seed bypasses the service layer.
  // 3 trips on different days/times so tests can target specific ones.

  const tripDefs = [
    {
      label: "Trip A (tomorrow 08:00)",
      departureTime: futureDate(1, 8, 0),
      estimatedArrivalTime: futureDate(1, 9, 0),
      notes: "Seed trip A — use for basic booking test",
    },
    {
      label: "Trip B (tomorrow 14:00)",
      departureTime: futureDate(1, 14, 0),
      estimatedArrivalTime: futureDate(1, 15, 0),
      notes: "Seed trip B — use for waitlist test",
    },
    {
      label: "Trip C (day after tomorrow 10:00)",
      departureTime: futureDate(2, 10, 0),
      estimatedArrivalTime: futureDate(2, 11, 0),
      notes: "Seed trip C — use for cancellation + promotion test",
    },
  ];

  const trips = [];
  for (const def of tripDefs) {
    // Idempotency: find by exact departure time within this company+branch.
    let trip = await prisma.trip.findFirst({
      where: {
        companyId: company.id,
        branchId: branch.id,
        departureTime: def.departureTime,
      },
    });
    if (!trip) {
      trip = await prisma.trip.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          boatId: boat.id,
          driverId: driver.id,
          departureTime: def.departureTime,
          estimatedArrivalTime: def.estimatedArrivalTime,
          status: "SCHEDULED",
          capacity: boat.capacity, // snapshot
          waitlistEnabled: true,
          notes: def.notes,
        },
      });
    }
    trips.push(trip);
    console.log(`✓ Trip      : ${def.label} (id: ${trip.id})`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SEED COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Company slug : harbor-norte
 Branch       : ${branch.id}

 PASSENGER    : passenger@harbor-norte.dev  /  passenger123
 OPERATOR     : operator@harbor-norte.dev   /  operator123
 ADMIN        : admin@harbor-norte.dev      /  admin123

 Trips (all with capacity 2, waitlist enabled):
${trips.map((t, i) => `   [${i + 1}] id: ${t.id}`).join("\n")}

 Use TRIP B or C to test the waitlist:
   — Book with PASSENGER  → CONFIRMED (seat 1)
   — Book with a 2nd user → CONFIRMED (seat 2)
   — 3rd booking          → WAITLISTED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
