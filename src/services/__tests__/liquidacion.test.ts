// =============================================================================
// Tests: liquidacion.service.ts
// =============================================================================
//
// UNIT TESTS (no DB, always run)
// ─────────────────────────────────────────────────────────────────────────────
// Test computeDistribucion() — the pure calculation function.
// No database connection required.
//
// INTEGRATION TESTS (require DATABASE_URL + seed data)
// ─────────────────────────────────────────────────────────────────────────────
// Skipped automatically when DATABASE_URL is not set.
// Require the seed to have been run (npx prisma db seed).
// Test calcularDistribucionViaje() and getResumenMensual() against real data.
// =============================================================================

import { describe, it, expect, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { computeDistribucion } from "../liquidacion.service";

// =============================================================================
// UNIT TESTS — computeDistribucion (pure function)
// =============================================================================

describe("computeDistribucion — pure logic", () => {
  // ── Original UABL example from spec ────────────────────────────────────────
  it("cap=10, 6 ocupados (Mant×3, Limp×2, Serv×1), 4 vacíos → 4/3=1.3333 c/u", () => {
    const result = computeDistribucion(10, [
      { departamentoId: "mant", count: 3 },
      { departamentoId: "limp", count: 2 },
      { departamentoId: "serv", count: 1 },
    ]);

    expect(result).toHaveLength(3);

    // Every department gets the same fraccionVacios = 4/3 = 1.3333
    const fraccion = new Prisma.Decimal("1.3333");
    for (const item of result) {
      expect(item.fraccionVacios.equals(fraccion)).toBe(true);
    }

    const mant = result.find((r) => r.departamentoId === "mant")!;
    const limp = result.find((r) => r.departamentoId === "limp")!;
    const serv = result.find((r) => r.departamentoId === "serv")!;

    // totalAsientos = asientosReservados + fraccion
    expect(mant.asientosReservados).toBe(3);
    expect(mant.totalAsientos.equals(new Prisma.Decimal("4.3333"))).toBe(true);

    expect(limp.asientosReservados).toBe(2);
    expect(limp.totalAsientos.equals(new Prisma.Decimal("3.3333"))).toBe(true);

    expect(serv.asientosReservados).toBe(1);
    expect(serv.totalAsientos.equals(new Prisma.Decimal("2.3333"))).toBe(true);
  });

  // ── Seed scenario: cap=8, 4 ocupados, 3 deptos ─────────────────────────────
  it("cap=8, 4 ocupados (Mant×2, Limp×1, ServExtra×1), vacíos=4, 3 deptos → 4/3=1.3333", () => {
    const result = computeDistribucion(8, [
      { departamentoId: "mant", count: 2 },
      { departamentoId: "limp", count: 1 },
      { departamentoId: "serv", count: 1 },
    ]);

    expect(result).toHaveLength(3);

    const fraccion = new Prisma.Decimal("1.3333");
    for (const item of result) {
      expect(item.fraccionVacios.equals(fraccion)).toBe(true);
    }

    // Σ totalAsientos ≈ 8 (rounding error ≤ 0.0001 × 3 depts)
    const suma = result.reduce(
      (acc, r) => acc.add(r.totalAsientos),
      new Prisma.Decimal(0),
    );
    // 3.3333 + 2.3333 + 2.3333 = 7.9999 — acceptable at 4 decimal places
    expect(suma.toNumber()).toBeGreaterThanOrEqual(7.999);
    expect(suma.toNumber()).toBeLessThanOrEqual(8.001);
  });

  // ── Trip completamente lleno — sin asientos vacíos ──────────────────────────
  it("cap=4, todos ocupados → fraccionVacios = 0 para todos", () => {
    const result = computeDistribucion(4, [
      { departamentoId: "a", count: 2 },
      { departamentoId: "b", count: 2 },
    ]);

    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item.fraccionVacios.equals(new Prisma.Decimal("0"))).toBe(true);
      expect(item.totalAsientos.toNumber()).toBe(item.asientosReservados);
    }
  });

  // ── Sin departamentos — resultado vacío ────────────────────────────────────
  it("sin departamentos → array vacío", () => {
    expect(computeDistribucion(10, [])).toHaveLength(0);
  });

  // ── Un solo departamento — absorbe todos los vacíos ────────────────────────
  it("cap=8, 1 depto con 3 reservas → absorbe los 5 vacíos completos", () => {
    const result = computeDistribucion(8, [{ departamentoId: "solo", count: 3 }]);

    expect(result).toHaveLength(1);
    expect(result[0]!.fraccionVacios.equals(new Prisma.Decimal("5"))).toBe(true);
    expect(result[0]!.totalAsientos.equals(new Prisma.Decimal("8"))).toBe(true);
  });

  // ── División exacta — sin residuo de redondeo ──────────────────────────────
  it("cap=6, 2 deptos con 2+1 reservas → 3 vacíos / 2 deptos = 1.5 exacto", () => {
    const result = computeDistribucion(6, [
      { departamentoId: "a", count: 2 },
      { departamentoId: "b", count: 1 },
    ]);

    const fraccion = new Prisma.Decimal("1.5");
    for (const item of result) {
      expect(item.fraccionVacios.equals(fraccion)).toBe(true);
    }

    const suma = result.reduce(
      (acc, r) => acc.add(r.totalAsientos),
      new Prisma.Decimal(0),
    );
    expect(suma.toNumber()).toBe(6);
  });

  // ── Presencia asimétrica — fraccion es IGUAL, no proporcional ──────────────
  it("dept con 1 reserva y dept con 10 reservas reciben la MISMA fraccionVacios", () => {
    const result = computeDistribucion(14, [
      { departamentoId: "grande", count: 10 },
      { departamentoId: "chico",  count: 1  },
    ]);

    // 3 vacíos / 2 deptos = 1.5 cada uno — igual sin importar tamaño
    expect(result[0]!.fraccionVacios.equals(result[1]!.fraccionVacios)).toBe(true);
    expect(result[0]!.fraccionVacios.equals(new Prisma.Decimal("1.5"))).toBe(true);
  });
});

// =============================================================================
// INTEGRATION TESTS — require DATABASE_URL and seed data
// =============================================================================

const hasDB = !!process.env["DATABASE_URL"];

describe.skipIf(!hasDB)("getLiquidacionesPorViaje — integration (seed data)", () => {
  afterAll(async () => {
    // Disconnect Prisma after integration tests to allow clean process exit.
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  });

  it("devuelve registros de liquidación para el viaje pasado con liquidacionCalculada=true", async () => {
    const { getLiquidacionesPorViaje } = await import("../liquidacion.service");
    const { prisma } = await import("@/lib/prisma");

    const seedTrip = await prisma.trip.findFirst({
      where:  { liquidacionCalculada: true, viajeStatus: "PASADO" },
      select: { id: true, capacity: true },
    });

    expect(seedTrip).not.toBeNull();

    const records = await getLiquidacionesPorViaje(seedTrip!.id);

    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(r.departamento).toBeTruthy();
      expect(r.asientosReservados).toBeGreaterThan(0);
      expect(r.totalAsientos.toNumber()).toBeGreaterThan(0);
      expect(r.fraccionVacios.toNumber()).toBeGreaterThanOrEqual(0);
    }

    // La suma de asientosReservados no puede superar la capacidad.
    const totalReservados = records.reduce((s, r) => s + r.asientosReservados, 0);
    expect(totalReservados).toBeLessThanOrEqual(seedTrip!.capacity);
  });

  it("devuelve array vacío para un viaje sin registros de liquidación", async () => {
    const { getLiquidacionesPorViaje } = await import("../liquidacion.service");
    const { prisma } = await import("@/lib/prisma");

    const pendingTrip = await prisma.trip.findFirst({
      where:  { liquidacionCalculada: false, viajeStatus: "PASADO" },
      select: { id: true },
    });

    expect(pendingTrip).not.toBeNull();

    const records = await getLiquidacionesPorViaje(pendingTrip!.id);
    expect(records).toHaveLength(0);
  });
});

describe.skipIf(!hasDB)("getResumenMensual — integration (seed data)", () => {
  it("devuelve resumen del mes con los datos del seed", async () => {
    const { getResumenMensual } = await import("../liquidacion.service");
    const { prisma } = await import("@/lib/prisma");

    // Find the month/year of the seeded liquidacion records.
    const sample = await prisma.asientoLiquidacion.findFirst({
      select: { mes: true, anio: true },
    });

    expect(sample).not.toBeNull();

    const resumen = await getResumenMensual(sample!.mes, sample!.anio);

    expect(resumen.length).toBeGreaterThan(0);
    for (const r of resumen) {
      expect(r.departamento).toBeTruthy();
      expect(r.totalAsientos.toNumber()).toBeGreaterThan(0);
      expect(r.cantidadViajes).toBeGreaterThan(0);
    }

    // Results should be ordered by totalAsientos DESC.
    for (let i = 1; i < resumen.length; i++) {
      expect(
        resumen[i - 1]!.totalAsientos.gte(resumen[i]!.totalAsientos),
      ).toBe(true);
    }
  });

  it("filtra por departamentoId cuando se provee", async () => {
    const { getResumenMensual } = await import("../liquidacion.service");
    const { prisma } = await import("@/lib/prisma");

    const sample = await prisma.asientoLiquidacion.findFirst({
      select: { mes: true, anio: true, departamentoId: true },
    });
    expect(sample).not.toBeNull();

    const filtered = await getResumenMensual(
      sample!.mes,
      sample!.anio,
      sample!.departamentoId,
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0]!.departamentoId).toBe(sample!.departamentoId);
  });
});

describe.skipIf(!hasDB)("calcularDistribucionViaje — integration (idempotency)", () => {
  it("retorna cached=true al llamarse dos veces sobre el mismo viaje liquidado", async () => {
    const { calcularDistribucionViaje } = await import("../liquidacion.service");
    const { prisma } = await import("@/lib/prisma");

    const seedTrip = await prisma.trip.findFirst({
      where:  { liquidacionCalculada: true, viajeStatus: "PASADO" },
      select: { id: true },
    });
    expect(seedTrip).not.toBeNull();

    const result = await calcularDistribucionViaje(seedTrip!.id);
    expect(result.cached).toBe(true);
    expect(result.distribucion.length).toBeGreaterThan(0);
  });

  it("lanza VIAJE_NO_PASADO para un viaje con viajeStatus=ACTIVO", async () => {
    const { calcularDistribucionViaje } = await import("../liquidacion.service");
    const { AppError } = await import("@/lib/errors");
    const { prisma } = await import("@/lib/prisma");

    const activeTrip = await prisma.trip.findFirst({
      where:  { viajeStatus: "ACTIVO" },
      select: { id: true },
    });
    expect(activeTrip).not.toBeNull();

    await expect(
      calcularDistribucionViaje(activeTrip!.id),
    ).rejects.toMatchObject({
      code:       "VIAJE_NO_PASADO",
      statusCode: 422,
    });
  });
});
