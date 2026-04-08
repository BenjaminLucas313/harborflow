// =============================================================================
// HarborFlow — Development Seed (V2)
// =============================================================================
//
// Creates a complete dataset for end-to-end testing of the V2 role system:
//
//   ORGANIZATIONS:
//   - 1 Provider Company  (slug: "lanchas-rosario")  — PROVIDER user
//   - 1 UABL Company      (slug: "uabl")             — UABL_STAFF users
//   - 2 Employer Companies (slug: "empresa-alfa", "empresa-beta") — COMPANY_REP + EMPLOYEE users
//
//   UABL STRUCTURE:
//   - 3 Departments with WorkTypes each
//
//   FLEET (under Provider):
//   - 1 Branch (Puerto Rosario)
//   - 2 Boats (capacity 20 each)
//   - 1 Driver
//   - 3 Trips
//
// IDEMPOTENT: safe to re-run.
//
// Run:
//   npx prisma db seed
//   — OR —
//   npx tsx prisma/seed.ts
//
// =============================================================================

import "dotenv/config";
import { PrismaClient, type Company } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ROUNDS = 10; // bcrypt rounds (10 = fast for dev)

/** Returns a Date set to HH:MM UTC on a day offset from today. */
function futureDate(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function upsertCompany(slug: string, name: string): Promise<Company> {
  return prisma.company.upsert({
    where: { slug },
    update: {},
    create: { name, slug, isActive: true },
  });
}

async function upsertUser(data: {
  companyId: string;
  branchId?: string;
  departmentId?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "EMPLOYEE" | "COMPANY_REP" | "UABL_STAFF" | "PROVIDER";
}) {
  const passwordHash = await bcrypt.hash(data.password, ROUNDS);
  return prisma.user.upsert({
    where: { companyId_email: { companyId: data.companyId, email: data.email } },
    update: { departmentId: data.departmentId ?? null },
    create: {
      companyId: data.companyId,
      branchId: data.branchId,
      departmentId: data.departmentId,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      isActive: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding HarborFlow V2 development data…\n");

  // =========================================================================
  // 1. Companies
  // =========================================================================

  const providerCompany = await upsertCompany("lanchas-rosario", "Lanchas Rosario S.A.");
  const uablCompany     = await upsertCompany("uabl", "UABL - Unión Argentina de Barcos de Lanchas");
  const empresaAlfa     = await upsertCompany("empresa-alfa", "Empresa Alfa S.R.L.");
  const empresaBeta     = await upsertCompany("empresa-beta", "Empresa Beta S.A.");

  console.log(`✓ Companies: ${providerCompany.name}, ${uablCompany.name}, ${empresaAlfa.name}, ${empresaBeta.name}`);

  // =========================================================================
  // 2. Branch (under Provider)
  // =========================================================================

  let branch = await prisma.branch.findFirst({
    where: { companyId: providerCompany.id, name: "Puerto Rosario" },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: providerCompany.id,
        name: "Puerto Rosario",
        address: "Av. Belgrano 1000, Rosario, Santa Fe",
        isActive: true,
      },
    });
  }
  console.log(`✓ Branch: ${branch.name}`);

  // =========================================================================
  // 3. UABL Departments and WorkTypes
  // =========================================================================

  async function upsertDepartment(name: string) {
    let dept = await prisma.department.findFirst({ where: { name } });
    if (!dept) {
      dept = await prisma.department.create({ data: { name, isActive: true } });
    }
    return dept;
  }

  async function upsertWorkType(departmentId: string, name: string) {
    let wt = await prisma.workType.findFirst({ where: { departmentId, name } });
    if (!wt) {
      wt = await prisma.workType.create({ data: { departmentId, name, isActive: true } });
    }
    return wt;
  }

  const deptInspeccion    = await upsertDepartment("Inspección de Cargas");
  const deptMantenimiento = await upsertDepartment("Mantenimiento y Obras");
  const deptAduana        = await upsertDepartment("Control Aduanero");

  console.log(`✓ Departments: ${deptInspeccion.name}, ${deptMantenimiento.name}, ${deptAduana.name}`);

  const wtInspeccionCarga  = await upsertWorkType(deptInspeccion.id,    "Inspección de carga general");
  const wtInspeccionGrano  = await upsertWorkType(deptInspeccion.id,    "Inspección de granos y cereales");
  const wtInspeccionQuim   = await upsertWorkType(deptInspeccion.id,    "Inspección de productos químicos");
  const wtMantenimientoPre = await upsertWorkType(deptMantenimiento.id, "Mantenimiento preventivo");
  const wtMantenimientoCor = await upsertWorkType(deptMantenimiento.id, "Reparación correctiva");
  const wtObrasCiviles     = await upsertWorkType(deptMantenimiento.id, "Obras civiles portuarias");
  const wtAduanaDoc        = await upsertWorkType(deptAduana.id,        "Control documental");
  const wtAduanaFisico     = await upsertWorkType(deptAduana.id,        "Control físico de mercadería");

  // Suppress unused warnings — all work types are valid seed data even if not used in sample allocation
  void wtInspeccionGrano; void wtInspeccionQuim;
  void wtMantenimientoPre; void wtMantenimientoCor; void wtObrasCiviles;
  void wtAduanaDoc; void wtAduanaFisico;

  console.log(`✓ WorkTypes: 8 created across 3 departments`);

  // =========================================================================
  // 4. Provider User
  // =========================================================================

  const provider = await upsertUser({
    companyId: providerCompany.id,
    branchId: branch.id,
    email: "proveedor@lanchas-rosario.dev",
    password: "proveedor123",
    firstName: "Roberto",
    lastName: "Lanceros",
    role: "PROVIDER",
  });
  console.log(`✓ Provider: ${provider.email} / proveedor123`);

  // =========================================================================
  // 5. UABL Staff Users (one per department)
  // =========================================================================

  const uablInspeccion = await upsertUser({
    companyId: uablCompany.id,
    departmentId: deptInspeccion.id,
    email: "inspeccion@uabl.dev",
    password: "uabl123",
    firstName: "Marcela",
    lastName: "Torres",
    role: "UABL_STAFF",
  });

  const uablMantenimiento = await upsertUser({
    companyId: uablCompany.id,
    departmentId: deptMantenimiento.id,
    email: "mantenimiento@uabl.dev",
    password: "uabl123",
    firstName: "Gustavo",
    lastName: "Pereyra",
    role: "UABL_STAFF",
  });

  const uablAduana = await upsertUser({
    companyId: uablCompany.id,
    departmentId: deptAduana.id,
    email: "aduana@uabl.dev",
    password: "uabl123",
    firstName: "Patricia",
    lastName: "Ríos",
    role: "UABL_STAFF",
  });

  void uablMantenimiento; void uablAduana;
  console.log(`✓ UABL Staff: ${uablInspeccion.email} (+ 2 more) / uabl123`);

  // =========================================================================
  // 6. Company Representatives
  // =========================================================================

  const repAlfa = await upsertUser({
    companyId: empresaAlfa.id,
    email: "representante@empresa-alfa.dev",
    password: "empresa123",
    firstName: "Lucas",
    lastName: "Martínez",
    role: "COMPANY_REP",
  });

  const repBeta = await upsertUser({
    companyId: empresaBeta.id,
    email: "representante@empresa-beta.dev",
    password: "empresa123",
    firstName: "Valeria",
    lastName: "González",
    role: "COMPANY_REP",
  });

  void repBeta;
  console.log(`✓ Company Reps: ${repAlfa.email}, ${repBeta.email} / empresa123`);

  // =========================================================================
  // 7. Employee Users
  // =========================================================================

  const employeeDefs = [
    { company: empresaAlfa, email: "juan.perez@empresa-alfa.dev",     firstName: "Juan",   lastName: "Pérez" },
    { company: empresaAlfa, email: "maria.garcia@empresa-alfa.dev",   firstName: "María",  lastName: "García" },
    { company: empresaAlfa, email: "diego.lopez@empresa-alfa.dev",    firstName: "Diego",  lastName: "López" },
    { company: empresaBeta, email: "ana.fernandez@empresa-beta.dev",  firstName: "Ana",    lastName: "Fernández" },
    { company: empresaBeta, email: "carlos.ruiz@empresa-beta.dev",    firstName: "Carlos", lastName: "Ruiz" },
  ] as const;

  const createdEmployees = [];
  for (const emp of employeeDefs) {
    const user = await upsertUser({
      companyId: emp.company.id,
      email: emp.email,
      password: "empleado123",
      firstName: emp.firstName,
      lastName: emp.lastName,
      role: "EMPLOYEE",
    });
    createdEmployees.push(user);
  }
  console.log(`✓ Employees: ${createdEmployees.length} created / empleado123`);

  // =========================================================================
  // 8. Fleet (Boats + Driver under Provider)
  // =========================================================================

  let barcoAlfa = await prisma.boat.findFirst({
    where: { companyId: providerCompany.id, name: "Lancha Rosario I" },
  });
  if (!barcoAlfa) {
    barcoAlfa = await prisma.boat.create({
      data: {
        companyId: providerCompany.id,
        branchId: branch.id,
        name: "Lancha Rosario I",
        capacity: 20,
        description: "Embarcación principal — 20 lugares",
        isActive: true,
      },
    });
  }

  let barcoBeta = await prisma.boat.findFirst({
    where: { companyId: providerCompany.id, name: "Lancha Rosario II" },
  });
  if (!barcoBeta) {
    barcoBeta = await prisma.boat.create({
      data: {
        companyId: providerCompany.id,
        branchId: branch.id,
        name: "Lancha Rosario II",
        capacity: 20,
        description: "Embarcación secundaria — 20 lugares",
        isActive: true,
      },
    });
  }

  console.log(`✓ Boats: ${barcoAlfa.name}, ${barcoBeta.name} (capacity: 20 each)`);

  let driver = await prisma.driver.findFirst({
    where: { companyId: providerCompany.id, firstName: "Héctor", lastName: "Cano" },
  });
  if (!driver) {
    driver = await prisma.driver.create({
      data: {
        companyId: providerCompany.id,
        branchId: branch.id,
        firstName: "Héctor",
        lastName: "Cano",
        licenseNumber: "NAV-ROS-001",
        phone: "+54 341 500 0001",
        isActive: true,
      },
    });
  }
  console.log(`✓ Driver: ${driver.firstName} ${driver.lastName}`);

  // =========================================================================
  // 9. Trips
  // =========================================================================

  const tripDefs = [
    {
      label: "Viaje A (mañana 07:00) — Lancha I",
      boat: barcoAlfa,
      departureTime: futureDate(1, 7, 0),
      estimatedArrivalTime: futureDate(1, 7, 30),
      notes: "Viaje matutino — turno 1",
    },
    {
      label: "Viaje B (mañana 13:00) — Lancha I",
      boat: barcoAlfa,
      departureTime: futureDate(1, 13, 0),
      estimatedArrivalTime: futureDate(1, 13, 30),
      notes: "Viaje mediodía — turno 2",
    },
    {
      label: "Viaje C (pasado mañana 07:00) — Lancha II",
      boat: barcoBeta,
      departureTime: futureDate(2, 7, 0),
      estimatedArrivalTime: futureDate(2, 7, 30),
      notes: "Segundo día — Lancha II",
    },
  ];

  const trips = [];
  for (const def of tripDefs) {
    let trip = await prisma.trip.findFirst({
      where: {
        companyId: providerCompany.id,
        branchId: branch.id,
        departureTime: def.departureTime,
      },
    });
    if (!trip) {
      trip = await prisma.trip.create({
        data: {
          companyId: providerCompany.id,
          branchId: branch.id,
          boatId: def.boat.id,
          driverId: driver.id,
          departureTime: def.departureTime,
          estimatedArrivalTime: def.estimatedArrivalTime,
          status: "SCHEDULED",
          capacity: def.boat.capacity,
          waitlistEnabled: true,
          notes: def.notes,
        },
      });
    }
    trips.push(trip);
    console.log(`✓ Trip: ${def.label}`);
  }

  // =========================================================================
  // 10. Sample TripAllocation — Empresa Alfa, Viaje A, 2 seats PENDING
  // =========================================================================

  const tripA = trips[0]!;
  const existingAlloc = await prisma.tripAllocation.findFirst({
    where: { companyId: empresaAlfa.id, tripId: tripA.id },
  });

  if (!existingAlloc) {
    const allocation = await prisma.tripAllocation.create({
      data: {
        companyId: empresaAlfa.id,
        tripId: tripA.id,
        requestedById: repAlfa.id,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    await prisma.seatRequest.create({
      data: {
        allocationId: allocation.id,
        employeeId: createdEmployees[0]!.id, // Juan Pérez
        workTypeId: wtInspeccionCarga.id,
        departmentId: deptInspeccion.id,
        status: "PENDING",
      },
    });

    await prisma.seatRequest.create({
      data: {
        allocationId: allocation.id,
        employeeId: createdEmployees[1]!.id, // María García
        workTypeId: wtInspeccionCarga.id,
        departmentId: deptInspeccion.id,
        status: "PENDING",
      },
    });

    console.log(`✓ Sample Allocation: Empresa Alfa → Viaje A (2 seats PENDING — ready for UABL)`);
  } else {
    console.log(`✓ Sample Allocation: already exists (skipped)`);
  }

  // =========================================================================
  // Summary
  // =========================================================================

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SEED COMPLETE — HarborFlow V2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 PROVEEDOR  →  /provider   (slug: lanchas-rosario)
   proveedor@lanchas-rosario.dev  /  proveedor123

 UABL STAFF  →  /uabl      (slug: uabl)
   inspeccion@uabl.dev      /  uabl123  (Inspección de Cargas)
   mantenimiento@uabl.dev   /  uabl123  (Mantenimiento y Obras)
   aduana@uabl.dev          /  uabl123  (Control Aduanero)

 COMPANY REPS  →  /company
   representante@empresa-alfa.dev  /  empresa123  (slug: empresa-alfa)
   representante@empresa-beta.dev  /  empresa123  (slug: empresa-beta)

 EMPLOYEES  →  /employee
   juan.perez@empresa-alfa.dev    /  empleado123
   maria.garcia@empresa-alfa.dev  /  empleado123
   diego.lopez@empresa-alfa.dev   /  empleado123
   ana.fernandez@empresa-beta.dev /  empleado123
   carlos.ruiz@empresa-beta.dev   /  empleado123

 HAPPY PATH DE PRUEBA:
   1. inspeccion@uabl.dev → /uabl → ver "Viaje A mañana 07:00"
      → 2 asientos en azul (PENDING) de Empresa Alfa
      → Confirmar asientos de Juan Pérez y María García
   2. juan.perez@empresa-alfa.dev → /employee → ver viaje confirmado
   3. representante@empresa-alfa.dev → /company → ver estado SUBMITTED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
