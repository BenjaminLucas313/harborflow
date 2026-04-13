// =============================================================================
// HarborFlow — V2 Development Seed
// =============================================================================
//
// Creates a complete dataset for end-to-end testing of the V2 role model:
//
//   ROLES                ENTITIES
//   ─────────────────    ────────────────────────────────────────────
//   PROVEEDOR (1)     →  manages fleet + port status
//   UABL admin (1)    →  manages departments + reviews Operaciones
//   UABL (2)          →  one per department (Operaciones, Mantenimiento)
//   EMPRESA (2)       →  one per employer (Constructora Norte, Servicios Portuarios)
//   USUARIO (4)       →  workers assignable to passenger slots
//
//   Departments (3)   →  Operaciones, Mantenimiento, Seguridad
//   WorkTypes (7)     →  spread across the three departments
//   Employers (2)     →  the real-world companies EMPRESA users book for
//   Boats (2)         →  Lancha Río Grande (cap 8), Lancha Delta (cap 6)
//   Driver (1)        →  Horacio Ríos
//   Trips (3)         →  future dates, all SCHEDULED
//   GroupBooking (1)  →  DRAFT booking from Constructora Norte on Trip 1
//   PassengerSlots (2)→  both PENDING, one per USUARIO — gives UABL something to review
//
// IDEMPOTENT: safe to re-run. Uses findFirst+create pattern for entities
// that lack a full unique key, and upsert for those that do.
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
// Constants
// ---------------------------------------------------------------------------

const COMPANY_SLUG = "harbor-rosario";
const ROUNDS = 10; // bcrypt cost — lower than prod (12) for dev speed

/** Returns a Date at HH:MM UTC, N calendar days from today. */
function futureDate(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

/** Returns a Date at HH:MM UTC, N calendar days in the past. */
function pastDate(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

/** Extracts calendar month (1-12) and year from a UTC Date. */
function getMesAnio(date: Date): { mes: number; anio: number } {
  return { mes: date.getUTCMonth() + 1, anio: date.getUTCFullYear() };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 HarborFlow V2 — seeding development data…\n");

  // ── 1. Company ──────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where:  { slug: COMPANY_SLUG },
    update: {},
    create: { name: "Harbor Rosario", slug: COMPANY_SLUG, isActive: true },
  });
  console.log(`✓ Company    : ${company.name}`);

  // ── 2. Branch ───────────────────────────────────────────────────────────
  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, name: "Puerto Rosario" },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name:      "Puerto Rosario",
        address:   "Av. Belgrano 100, Rosario, Santa Fe",
        isActive:  true,
      },
    });
  }
  console.log(`✓ Branch     : ${branch.name}`);

  // ── 3. Departments ───────────────────────────────────────────────────────
  // Uses upsert on @@unique([companyId, name]) so re-running never duplicates
  // or deletes existing records. update:{} intentionally empty — we only want
  // to create if absent, never overwrite manual changes made post-seed.
  const deptDefs = [
    { name: "Operaciones",     description: "Carga, descarga y logística portuaria",   emailContacto: "operaciones@uabl.dev"   },
    { name: "Mantenimiento",   description: "Mantenimiento eléctrico y mecánico",      emailContacto: "mantenimiento@uabl.dev" },
    { name: "Seguridad",       description: "Guardia y vigilancia portuaria",          emailContacto: "seguridad@uabl.dev"     },
    { name: "Limpieza",        description: "Limpieza y saneamiento de instalaciones", emailContacto: "limpieza@uabl.dev"      },
    { name: "Servicios Extras",description: "Servicios complementarios y soporte",     emailContacto: null                     },
  ];

  const depts: Record<string, { id: string; name: string }> = {};
  for (const def of deptDefs) {
    const dept = await prisma.department.upsert({
      where:  { companyId_name: { companyId: company.id, name: def.name } },
      update: {},
      create: {
        companyId:     company.id,
        name:          def.name,
        description:   def.description,
        emailContacto: def.emailContacto,
        isActive:      true,
      },
    });
    depts[def.name] = dept;
    console.log(`✓ Dept       : ${dept.name}`);
  }

  // ── 4. WorkTypes ─────────────────────────────────────────────────────────
  // Spread across the three departments. Code is unique per company.
  const wtDefs = [
    // Operaciones
    { code: "CARGA",    name: "Carga de mercadería",     dept: "Operaciones" },
    { code: "DESCARGA", name: "Descarga de mercadería",  dept: "Operaciones" },
    { code: "LOG",      name: "Logística y acopio",      dept: "Operaciones" },
    // Mantenimiento
    { code: "MANT_EL",  name: "Mantenimiento eléctrico", dept: "Mantenimiento" },
    { code: "MANT_MEC", name: "Mantenimiento mecánico",  dept: "Mantenimiento" },
    // Seguridad
    { code: "GUARD",    name: "Guardia portuaria",       dept: "Seguridad" },
    { code: "INSP_SEG", name: "Inspección de seguridad", dept: "Seguridad" },
  ];

  const workTypes: Record<string, { id: string; name: string; departmentId: string }> = {};
  for (const def of wtDefs) {
    const deptId = depts[def.dept]!.id;
    let wt = await prisma.workType.findFirst({
      where: { companyId: company.id, code: def.code },
    });
    if (!wt) {
      wt = await prisma.workType.create({
        data: {
          companyId:    company.id,
          departmentId: deptId,
          name:         def.name,
          code:         def.code,
          isActive:     true,
        },
      });
    }
    workTypes[def.code] = wt;
    console.log(`✓ WorkType   : [${wt.code}] ${wt.name}`);
  }

  // ── 5. Employers ─────────────────────────────────────────────────────────
  const employerDefs = [
    { name: "Constructora Norte S.A.",    taxId: "30-12345678-9" },
    { name: "Servicios Portuarios Ltda.", taxId: "30-87654321-0" },
  ];

  const employers: Record<string, { id: string; name: string }> = {};
  for (const def of employerDefs) {
    let emp = await prisma.employer.findFirst({
      where: { companyId: company.id, taxId: def.taxId },
    });
    if (!emp) {
      emp = await prisma.employer.create({
        data: { companyId: company.id, name: def.name, taxId: def.taxId, isActive: true },
      });
    }
    employers[def.name] = emp;
    console.log(`✓ Employer   : ${emp.name}`);
  }

  // ── 6. Users ─────────────────────────────────────────────────────────────
  console.log("");
  const userDefs = [
    // PROVEEDOR — manages fleet and port status
    {
      key:        "proveedor",
      email:      "proveedor@rosario.dev",
      password:   "proveedor123",
      firstName:  "Tomás",
      lastName:   "Ferreyra",
      role:       "PROVEEDOR" as const,
      branchId:   branch.id,
    },
    // UABL admin — can manage depts/worktypes + reviews Operaciones
    {
      key:         "uabl.admin",
      email:       "uabl.admin@rosario.dev",
      password:    "uabl123",
      firstName:   "Valentina",
      lastName:    "Morales",
      role:        "UABL" as const,
      departmentId: depts["Operaciones"]!.id,
      isUablAdmin:  true,
    },
    // UABL Operaciones — reviews Operaciones slots only
    {
      key:         "uabl.operaciones",
      email:       "uabl.operaciones@rosario.dev",
      password:    "uabl123",
      firstName:   "Diego",
      lastName:    "Navarro",
      role:        "UABL" as const,
      departmentId: depts["Operaciones"]!.id,
    },
    // UABL Mantenimiento — reviews Mantenimiento slots only
    {
      key:         "uabl.mantenimiento",
      email:       "uabl.mantenimiento@rosario.dev",
      password:    "uabl123",
      firstName:   "Graciela",
      lastName:    "Ibáñez",
      role:        "UABL" as const,
      departmentId: depts["Mantenimiento"]!.id,
    },
    // EMPRESA — Constructora Norte
    {
      key:        "empresa.constructora",
      email:      "empresa@constructora.dev",
      password:   "empresa123",
      firstName:  "Roberto",
      lastName:   "Salinas",
      role:       "EMPRESA" as const,
      employerId: employers["Constructora Norte S.A."]!.id,
    },
    // EMPRESA — Servicios Portuarios
    {
      key:        "empresa.servicios",
      email:      "empresa@servicios.dev",
      password:   "empresa123",
      firstName:  "Claudia",
      lastName:   "Vega",
      role:       "EMPRESA" as const,
      employerId: employers["Servicios Portuarios Ltda."]!.id,
    },
    // USUARIO — workers assignable to slots
    {
      key:       "usuario.juan",
      email:     "juan.perez@rosario.dev",
      password:  "usuario123",
      firstName: "Juan",
      lastName:  "Pérez",
      role:      "USUARIO" as const,
    },
    {
      key:       "usuario.maria",
      email:     "maria.garcia@rosario.dev",
      password:  "usuario123",
      firstName: "María",
      lastName:  "García",
      role:      "USUARIO" as const,
    },
    {
      key:       "usuario.pedro",
      email:     "pedro.lopez@rosario.dev",
      password:  "usuario123",
      firstName: "Pedro",
      lastName:  "López",
      role:      "USUARIO" as const,
    },
    {
      key:       "usuario.lucia",
      email:     "lucia.martinez@rosario.dev",
      password:  "usuario123",
      firstName: "Lucía",
      lastName:  "Martínez",
      role:      "USUARIO" as const,
    },
  ] as const;

  const createdUsers: Record<string, { id: string; email: string }> = {};
  for (const def of userDefs) {
    const hash = await bcrypt.hash(def.password, ROUNDS);
    const user = await prisma.user.upsert({
      where:  { companyId_email: { companyId: company.id, email: def.email } },
      // Always sync role + V2 fields so re-seeding fixes any stale/legacy values.
      update: {
        role:         def.role,
        firstName:    def.firstName,
        lastName:     def.lastName,
        passwordHash: hash,
        isActive:     true,
        ...("departmentId" in def ? { departmentId: def.departmentId } : {}),
        ...("employerId"   in def ? { employerId:   def.employerId }   : {}),
        ...("isUablAdmin"  in def ? { isUablAdmin:  def.isUablAdmin }  : {}),
      },
      create: {
        companyId:    company.id,
        email:        def.email,
        passwordHash: hash,
        firstName:    def.firstName,
        lastName:     def.lastName,
        role:         def.role,
        isActive:     true,
        // Optional V2 fields — only set if present
        ...("branchId"    in def ? { branchId:    def.branchId }    : {}),
        ...("departmentId" in def ? { departmentId: def.departmentId } : {}),
        ...("employerId"   in def ? { employerId:   def.employerId }   : {}),
        ...("isUablAdmin"  in def ? { isUablAdmin:  def.isUablAdmin }  : {}),
      },
    });
    createdUsers[def.key] = user;
    const tag = def.role.padEnd(10);
    console.log(`✓ User [${tag}]: ${user.email} / ${def.password}`);
  }

  // ── 7. Driver ───────────────────────────────────────────────────────────
  console.log("");
  let driver = await prisma.driver.findFirst({
    where: { companyId: company.id, firstName: "Horacio", lastName: "Ríos" },
  });
  if (!driver) {
    driver = await prisma.driver.create({
      data: {
        companyId:     company.id,
        branchId:      branch.id,
        firstName:     "Horacio",
        lastName:      "Ríos",
        licenseNumber: "NAV-2024-001",
        phone:         "+54 341 500 0001",
        isActive:      true,
      },
    });
  }
  console.log(`✓ Driver     : ${driver.firstName} ${driver.lastName}`);

  // ── 8. Boats ─────────────────────────────────────────────────────────────
  const boatDefs = [
    {
      name:        "Lancha Río Grande",
      capacity:    8,
      description: "Lancha principal. Capacidad 8 pasajeros.",
    },
    {
      name:        "Lancha Delta",
      capacity:    6,
      description: "Embarcación auxiliar. Capacidad 6 pasajeros.",
    },
  ];

  const boats: { id: string; name: string; capacity: number }[] = [];
  for (const def of boatDefs) {
    let boat = await prisma.boat.findFirst({
      where: { companyId: company.id, branchId: branch.id, name: def.name },
    });
    if (!boat) {
      boat = await prisma.boat.create({
        data: {
          companyId:   company.id,
          branchId:    branch.id,
          name:        def.name,
          capacity:    def.capacity,
          description: def.description,
          isActive:    true,
        },
      });
    }
    boats.push(boat);
    console.log(`✓ Boat       : ${boat.name} (cap. ${boat.capacity})`);
  }

  // ── 9. Trips ─────────────────────────────────────────────────────────────
  const mainBoat = boats[0]!;
  const tripDefs = [
    {
      label:                "Trip 1 — mañana 08:00",
      boatId:               mainBoat.id,
      departureTime:        futureDate(1, 8, 0),
      estimatedArrivalTime: futureDate(1, 9, 0),
      notes:                "Turno mañana — ideal para probar GroupBooking y revisión UABL",
    },
    {
      label:                "Trip 2 — mañana 14:00",
      boatId:               mainBoat.id,
      departureTime:        futureDate(1, 14, 0),
      estimatedArrivalTime: futureDate(1, 15, 0),
      notes:                "Turno tarde — para probar segunda reserva grupal",
    },
    {
      label:                "Trip 3 — pasado mañana 10:00",
      boatId:               boats[1]!.id,
      departureTime:        futureDate(2, 10, 0),
      estimatedArrivalTime: futureDate(2, 11, 0),
      notes:                "Lancha Delta — para probar capacidad menor (6)",
    },
  ];

  const trips: { id: string }[] = [];
  for (const def of tripDefs) {
    let trip = await prisma.trip.findFirst({
      where: { companyId: company.id, branchId: branch.id, departureTime: def.departureTime },
    });
    if (!trip) {
      const boat = await prisma.boat.findUnique({ where: { id: def.boatId } });
      trip = await prisma.trip.create({
        data: {
          companyId:            company.id,
          branchId:             branch.id,
          boatId:               def.boatId,
          driverId:             driver.id,
          departureTime:        def.departureTime,
          estimatedArrivalTime: def.estimatedArrivalTime,
          status:               "SCHEDULED",
          capacity:             boat!.capacity,
          waitlistEnabled:      true,
          notes:                def.notes,
        },
      });
    }
    trips.push(trip);
    console.log(`✓ Trip       : ${def.label} (id: ${trip.id})`);
  }

  // ── 10. Sample GroupBooking + PassengerSlots ──────────────────────────────
  // One DRAFT GroupBooking from Constructora Norte on Trip 1.
  // Two PENDING slots — Juan Pérez (CARGA) and María García (MANT_EL).
  // This gives the UABL users something to review immediately on first login.

  console.log("");
  const trip1 = trips[0]!;
  const empresaConstructora = createdUsers["empresa.constructora"]!;
  const empleadorConstructora = employers["Constructora Norte S.A."]!;

  let groupBooking = await prisma.groupBooking.findFirst({
    where: {
      companyId:  company.id,
      tripId:     trip1.id,
      employerId: empleadorConstructora.id,
    },
  });

  if (!groupBooking) {
    groupBooking = await prisma.groupBooking.create({
      data: {
        companyId:  company.id,
        branchId:   branch.id,
        tripId:     trip1.id,
        employerId: empleadorConstructora.id,
        bookedById: empresaConstructora.id,
        status:     "SUBMITTED", // already submitted → UABL can review
        notes:      "Turno regular — cuadrilla de carga y mantenimiento",
      },
    });
    console.log(`✓ GroupBooking: SUBMITTED (id: ${groupBooking.id})`);

    // Slot 1: Juan Pérez — CARGA (routes to Operaciones)
    const wtCarga = workTypes["CARGA"]!;
    const juanId  = createdUsers["usuario.juan"]!.id;
    const slot1Exists = await prisma.passengerSlot.findUnique({
      where: { tripId_usuarioId: { tripId: trip1.id, usuarioId: juanId } },
    });
    if (!slot1Exists) {
      await prisma.passengerSlot.create({
        data: {
          companyId:         company.id,
          groupBookingId:    groupBooking.id,
          tripId:            trip1.id,
          branchId:          branch.id,
          usuarioId:         juanId,
          workTypeId:        wtCarga.id,
          departmentId:      wtCarga.departmentId,
          representedCompany: "Constructora Norte S.A.",
          status:            "PENDING",
        },
      });
      console.log(`✓ Slot 1     : Juan Pérez — CARGA → Operaciones (PENDING)`);
    }

    // Slot 2: María García — MANT_EL (routes to Mantenimiento)
    const wtMantEl = workTypes["MANT_EL"]!;
    const mariaId  = createdUsers["usuario.maria"]!.id;
    const slot2Exists = await prisma.passengerSlot.findUnique({
      where: { tripId_usuarioId: { tripId: trip1.id, usuarioId: mariaId } },
    });
    if (!slot2Exists) {
      await prisma.passengerSlot.create({
        data: {
          companyId:         company.id,
          groupBookingId:    groupBooking.id,
          tripId:            trip1.id,
          branchId:          branch.id,
          usuarioId:         mariaId,
          workTypeId:        wtMantEl.id,
          departmentId:      wtMantEl.departmentId,
          representedCompany: "Constructora Norte S.A.",
          status:            "PENDING",
        },
      });
      console.log(`✓ Slot 2     : María García — MANT_EL → Mantenimiento (PENDING)`);
    }
  } else {
    console.log(`✓ GroupBooking: already exists (id: ${groupBooking.id})`);
  }

  // ── 11. Sample TripRequests ───────────────────────────────────────────────
  // One PENDING request from each EMPRESA user — exercises the on-demand
  // boat request flow and lets PROVEEDOR review them immediately.

  console.log("");
  const empresaServiceUser = createdUsers["empresa.servicios"]!;

  // Request 1 — Constructora Norte, PENDING (not yet reviewed)
  const existingReq1 = await prisma.tripRequest.findFirst({
    where: {
      companyId:     company.id,
      requestedById: empresaConstructora.id,
      origin:        "Terminal Norte",
    },
  });
  if (!existingReq1) {
    await prisma.tripRequest.create({
      data: {
        company:        { connect: { id: company.id } },
        origin:         "Terminal Norte",
        destination:    "Dársena Sur",
        requestedDate:  futureDate(3, 7, 30),
        passengerCount: 4,
        notes:          "Cuadrilla de carga — turno madrugada",
        requestedBy:    { connect: { id: empresaConstructora.id } },
      },
    });
    console.log(`✓ TripRequest 1: Constructora Norte → Terminal Norte→Dársena Sur (PENDING)`);
  } else {
    console.log(`✓ TripRequest 1: already exists`);
  }

  // Request 2 — Servicios Portuarios, PENDING
  const existingReq2 = await prisma.tripRequest.findFirst({
    where: {
      companyId:     company.id,
      requestedById: empresaServiceUser.id,
      origin:        "Muelle Central",
    },
  });
  if (!existingReq2) {
    await prisma.tripRequest.create({
      data: {
        company:        { connect: { id: company.id } },
        origin:         "Muelle Central",
        destination:    "Zona Franca",
        requestedDate:  futureDate(4, 9, 0),
        passengerCount: 2,
        notes:          "Inspección programada",
        requestedBy:    { connect: { id: empresaServiceUser.id } },
      },
    });
    console.log(`✓ TripRequest 2: Servicios Portuarios → Muelle Central→Zona Franca (PENDING)`);
  } else {
    console.log(`✓ TripRequest 2: already exists`);
  }

  // ── 12. Past trips for liquidation testing ───────────────────────────────
  // Two completed trips with viajeStatus=PASADO.
  //   Viaje pasado 1 → will get AsientoLiquidacion records (liquidacionCalculada=true)
  //   Viaje pasado 2 → left without records (liquidacionCalculada=false, "pending")
  // Boat capacities: Lancha Río Grande=8, Lancha Delta=6.
  // mainBoat (boats[0]) already declared in section 9.

  console.log("");
  const deltaBoat = boats[1]!;

  const depT1 = pastDate(10, 8,  0);
  const depT2 = pastDate(5,  14, 0);

  let pastTrip1 = await prisma.trip.findFirst({
    where: { companyId: company.id, branchId: branch.id, departureTime: depT1 },
  });
  if (!pastTrip1) {
    pastTrip1 = await prisma.trip.create({
      data: {
        companyId:            company.id,
        branchId:             branch.id,
        boatId:               mainBoat.id,
        driverId:             driver.id,
        departureTime:        depT1,
        estimatedArrivalTime: pastDate(10, 9, 0),
        status:               "COMPLETED",
        viajeStatus:          "PASADO",
        liquidacionCalculada: true,   // will receive AsientoLiquidacion records below
        capacity:             mainBoat.capacity,
        waitlistEnabled:      false,
        notes:                "Seed: viaje pasado — liquidación calculada (cap 8, 4 ocupados)",
      },
    });
  }
  console.log(`✓ Viaje pasado 1: ${depT1.toISOString().slice(0, 10)} 08:00 — cap ${mainBoat.capacity} (id: ${pastTrip1.id})`);

  let pastTrip2 = await prisma.trip.findFirst({
    where: { companyId: company.id, branchId: branch.id, departureTime: depT2 },
  });
  if (!pastTrip2) {
    pastTrip2 = await prisma.trip.create({
      data: {
        companyId:            company.id,
        branchId:             branch.id,
        boatId:               deltaBoat.id,
        driverId:             driver.id,
        departureTime:        depT2,
        estimatedArrivalTime: pastDate(5, 15, 0),
        status:               "COMPLETED",
        viajeStatus:          "PASADO",
        liquidacionCalculada: false,  // left pending — no AsientoLiquidacion yet
        capacity:             deltaBoat.capacity,
        waitlistEnabled:      false,
        notes:                "Seed: viaje pasado — liquidación pendiente (cap 6, 2 ocupados)",
      },
    });
  }
  console.log(`✓ Viaje pasado 2: ${depT2.toISOString().slice(0, 10)} 14:00 — cap ${deltaBoat.capacity} (id: ${pastTrip2.id})`);

  // ── 13. Sample reservations on past trips (V1 legacy model) ──────────────
  // Creates CHECKED_IN reservations with departamentoId set so the liquidation
  // engine has seat-per-department data to read.
  //
  // Viaje pasado 1 — 4 seats occupied (capacity 8, 4 vacant):
  //   Mantenimiento   → juan, maria  (2 seats)
  //   Limpieza        → pedro        (1 seat)
  //   Servicios Extras→ lucia        (1 seat)
  //
  // Viaje pasado 2 — 2 seats occupied (capacity 6, 4 vacant):
  //   Mantenimiento   → juan         (1 seat)
  //   Limpieza        → pedro        (1 seat)
  //
  // Only creates records where none exist yet (idempotent via findFirst check).
  // Does NOT overwrite existing reservations that already have departamentoId.

  console.log("");
  const reservationDefs = [
    // ── Viaje pasado 1 ──────────────────────────────────────────────────────
    { trip: pastTrip1, user: createdUsers["usuario.juan"]!,   dept: "Mantenimiento"   },
    { trip: pastTrip1, user: createdUsers["usuario.maria"]!,  dept: "Mantenimiento"   },
    { trip: pastTrip1, user: createdUsers["usuario.pedro"]!,  dept: "Limpieza"        },
    { trip: pastTrip1, user: createdUsers["usuario.lucia"]!,  dept: "Servicios Extras"},
    // ── Viaje pasado 2 ──────────────────────────────────────────────────────
    { trip: pastTrip2, user: createdUsers["usuario.juan"]!,   dept: "Mantenimiento"   },
    { trip: pastTrip2, user: createdUsers["usuario.pedro"]!,  dept: "Limpieza"        },
  ];

  for (const def of reservationDefs) {
    const existing = await prisma.reservation.findFirst({
      where: { companyId: company.id, tripId: def.trip.id, userId: def.user.id },
    });
    if (!existing) {
      await prisma.reservation.create({
        data: {
          companyId:     company.id,
          branchId:      branch.id,
          userId:        def.user.id,
          tripId:        def.trip.id,
          departamentoId: depts[def.dept]!.id,
          status:        "CHECKED_IN",
        },
      });
    }
    const userName = def.user.email.split("@")[0];
    console.log(`✓ Reserva    : ${userName} — ${def.dept} en viaje ${def.trip.id.slice(-6)}`);
  }

  // Defensive: assign fallback department to any remaining V1 reservations
  // that still have departamentoId = null (e.g. pre-seed prod data).
  // Uses Mantenimiento as a conservative default. This only fires if null
  // records exist — never overwrites an already-set departamentoId.
  const fallbackDept   = depts["Mantenimiento"]!;
  const updatedNulls   = await prisma.reservation.updateMany({
    where: { companyId: company.id, departamentoId: null },
    data:  { departamentoId: fallbackDept.id },
  });
  if (updatedNulls.count > 0) {
    console.log(`⚠  Fallback   : ${updatedNulls.count} reserva(s) sin departamento asignadas a Mantenimiento`);
  }

  // ── 14. AsientoLiquidacion examples (viaje pasado 1 only) ────────────────
  // Demonstrates the proportional distribution formula:
  //   fraccionVacios[dept] = vacíos * (asientosReservados[dept] / totalOcupados)
  //   totalAsientos[dept]  = asientosReservados[dept] + fraccionVacios[dept]
  //
  // Viaje pasado 1 — capacity=8, occupied=4, vacant=4:
  //   Mantenimiento   : 4 * (2/4) = 2.0000  → total 4.0000
  //   Limpieza        : 4 * (1/4) = 1.0000  → total 2.0000
  //   Servicios Extras: 4 * (1/4) = 1.0000  → total 2.0000
  //   Σ totalAsientos = 8 ✓
  //
  // Viaje pasado 2 has NO records (liquidacionCalculada=false) — tests the
  // "pending liquidation" query path.

  console.log("");
  const { mes: mesPT1, anio: anioPT1 } = getMesAnio(pastTrip1.departureTime);

  const liquidacionDefs = [
    {
      departamento:      "Mantenimiento",
      asientosReservados: 2,
      fraccionVacios:    "2.0000",
      totalAsientos:     "4.0000",
    },
    {
      departamento:      "Limpieza",
      asientosReservados: 1,
      fraccionVacios:    "1.0000",
      totalAsientos:     "2.0000",
    },
    {
      departamento:      "Servicios Extras",
      asientosReservados: 1,
      fraccionVacios:    "1.0000",
      totalAsientos:     "2.0000",
    },
  ];

  for (const def of liquidacionDefs) {
    const deptId = depts[def.departamento]!.id;
    await prisma.asientoLiquidacion.upsert({
      where:  { viajeId_departamentoId: { viajeId: pastTrip1.id, departamentoId: deptId } },
      update: {},
      create: {
        companyId:          company.id,
        branchId:           branch.id,
        viajeId:            pastTrip1.id,
        departamentoId:     deptId,
        asientosReservados: def.asientosReservados,
        fraccionVacios:     def.fraccionVacios,
        totalAsientos:      def.totalAsientos,
        mes:                mesPT1,
        anio:               anioPT1,
      },
    });
    console.log(
      `✓ Liquidación: ${def.departamento.padEnd(15)} | reserv=${def.asientosReservados} | fracc=${def.fraccionVacios} | total=${def.totalAsientos}`
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 V2 SEED COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 PROVEEDOR
   proveedor@rosario.dev         / proveedor123

 UABL (admin + Operaciones)
   uabl.admin@rosario.dev        / uabl123   [isUablAdmin]
   uabl.operaciones@rosario.dev  / uabl123   [dept: Operaciones]
   uabl.mantenimiento@rosario.dev / uabl123  [dept: Mantenimiento]

 EMPRESA
   empresa@constructora.dev      / empresa123  [Constructora Norte]
   empresa@servicios.dev         / empresa123  [Servicios Portuarios]

 USUARIO (workers)
   juan.perez@rosario.dev        / usuario123
   maria.garcia@rosario.dev      / usuario123
   pedro.lopez@rosario.dev       / usuario123
   lucia.martinez@rosario.dev    / usuario123

 Preloaded: 1 SUBMITTED GroupBooking (Trip 1, Constructora Norte)
   Slot 1: Juan Pérez    — CARGA    → pending Operaciones review
   Slot 2: María García  — MANT_EL  → pending Mantenimiento review

 Preloaded: 2 PENDING TripRequests
   Req 1: Constructora Norte  — Terminal Norte → Dársena Sur (4 pasajeros)
   Req 2: Servicios Portuarios — Muelle Central → Zona Franca (2 pasajeros)

 Departments (5 total)
   Operaciones, Mantenimiento, Seguridad, Limpieza, Servicios Extras

 Viajes pasados (liquidación)
   Viaje pasado 1 → COMPLETED, liquidacionCalculada=true
     cap=8, ocupados=4 (Mant×2, Limp×1, ServExtra×1), vacíos=4
     AsientoLiquidacion: Mant=4.0, Limp=2.0, ServExtra=2.0 ✓
   Viaje pasado 2 → COMPLETED, liquidacionCalculada=false (pendiente)
     cap=6, ocupados=2 (Mant×1, Limp×1), sin registros aún

 TESTING CHECKLIST
 ─────────────────
 □ Log in as uabl.operaciones   → see pending slot for Juan Pérez
 □ Log in as uabl.mantenimiento → see pending slot for María García
 □ Confirm/reject a slot        → GroupBooking status recalculates
 □ Log in as empresa@constructora → see GroupBooking + 1 TripRequest pending
 □ Log in as empresa@servicios   → see 1 TripRequest pending
 □ Log in as proveedor          → see trips, 2 TripRequests to review
 □ Proveedor acepta TripRequest → Trip se crea automáticamente
 □ Log in as uabl.admin         → manage departamentos + tipos de trabajo
 □ Log in as juan.perez         → see Trip 1 as assigned (read-only)
 □ Query AsientoLiquidacion     → verify proportional distribution (Σ=8)
 □ Query trips WHERE liquidacionCalculada=false AND viajeStatus=PASADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
