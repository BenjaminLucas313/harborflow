import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Argentina timezone (UTC-3, no DST)
// ---------------------------------------------------------------------------

const ARG_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Returns [start, end] UTC timestamps for "today" in Argentina time.
 * Argentina midnight = 03:00 UTC on the same calendar date.
 */
function argTodayRange(): { start: Date; end: Date } {
  const nowArg = new Date(Date.now() - ARG_OFFSET_MS);
  const start  = new Date(
    Date.UTC(nowArg.getUTCFullYear(), nowArg.getUTCMonth(), nowArg.getUTCDate(), 3, 0, 0, 0),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

type AuthGuard =
  | { ok: true; companyId: string }
  | { ok: false; response: NextResponse };

async function requireUabl(): Promise<AuthGuard> {
  const session = await auth();
  if (!session) {
    return {
      ok:       false,
      response: NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 }),
    };
  }
  if (session.user.role !== "UABL") {
    return {
      ok:       false,
      response: NextResponse.json({ error: { message: "Sin acceso" } }, { status: 403 }),
    };
  }
  return { ok: true, companyId: session.user.companyId };
}

// ---------------------------------------------------------------------------
// GET /api/uabl/viajes-del-dia
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    const guard = await requireUabl();
    if (!guard.ok) return guard.response;

    const { companyId } = guard;
    const { start, end } = argTodayRange();
    const now       = new Date();
    const WINDOW_MS = 30 * 60 * 1000; // 30-minute boarding window

    const trips = await prisma.trip.findMany({
      where: {
        companyId,
        departureTime: { gte: start, lte: end },
      },
      select: {
        id:                  true,
        departureTime:       true,
        status:              true,
        viajeStatus:         true,
        salidaConfirmada:    true,
        liquidacionCalculada: true,
        capacity:            true,
        boat:   { select: { name: true } },
        driver: { select: { firstName: true, lastName: true } },
        _count: {
          select: { passengerSlots: { where: { status: "CONFIRMED" } } },
        },
      },
      orderBy: { departureTime: "asc" },
    });

    const programados: typeof trips = [];
    const enEmbarque:  typeof trips = [];
    const partidos:    typeof trips = [];
    const completados: typeof trips = [];

    for (const trip of trips) {
      const depMs = trip.departureTime.getTime();
      const nowMs = now.getTime();

      if (
        trip.viajeStatus === "PASADO"    ||
        trip.viajeStatus === "CANCELADO" ||
        trip.status      === "CANCELLED" ||
        trip.status      === "DEPARTED"  ||
        trip.status      === "COMPLETED"
      ) {
        completados.push(trip);
        continue;
      }

      if (trip.salidaConfirmada) {
        partidos.push(trip);
        continue;
      }

      if (depMs >= nowMs - WINDOW_MS && depMs <= nowMs + WINDOW_MS) {
        enEmbarque.push(trip);
        continue;
      }

      programados.push(trip);
    }

    const totalSlots    = trips.reduce((s, t) => s + t._count.passengerSlots, 0);
    const totalCapacity = trips.reduce((s, t) => s + t.capacity, 0);
    const ocupacionPromedio =
      totalCapacity > 0 ? Math.round((totalSlots / totalCapacity) * 100) : 0;

    return NextResponse.json({
      programados,
      enEmbarque,
      partidos,
      completados,
      totalHoy:          trips.length,
      ocupacionPromedio,
      generadoEn:        now.toISOString(),
    });
  } catch (err) {
    console.error("[viajes-del-dia] GET error:", err);
    return NextResponse.json(
      { error: { message: "Error interno del servidor" } },
      { status: 500 },
    );
  }
}
