// GET /api/conductor/viajes
// Returns upcoming and past trips for the authenticated CONDUCTOR user.
// Each trip includes boat name, port name, and confirmed passenger count.

import { NextResponse }  from "next/server";
import { SlotStatus }    from "@prisma/client";
import { auth }          from "@/lib/auth";
import { prisma }        from "@/lib/prisma";

const ACTIVE_STATUSES: SlotStatus[] = ["PENDING", "CONFIRMED"];

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }
  if (session.user.role !== "CONDUCTOR") {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

  const driver = await prisma.driver.findFirst({
    where:  { userId: session.user.id, isActive: true },
    select: { id: true },
  });

  if (!driver) {
    return NextResponse.json(
      { data: null, error: { code: "DRIVER_NOT_LINKED", message: "Tu cuenta no está vinculada a un perfil de conductor." } },
      { status: 404 },
    );
  }

  const now = new Date();

  const [upcoming, past] = await Promise.all([
    prisma.trip.findMany({
      where: { driverId: driver.id, departureTime: { gte: now } },
      select: {
        id:            true,
        departureTime: true,
        status:        true,
        capacity:      true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        passengerSlots: {
          where:  { status: { in: ACTIVE_STATUSES } },
          select: {
            usuario:    { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { departureTime: "asc" },
      take: 20,
    }),
    prisma.trip.findMany({
      where: { driverId: driver.id, departureTime: { lt: now } },
      select: {
        id:            true,
        departureTime: true,
        status:        true,
        capacity:      true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        _count: {
          select: { passengerSlots: { where: { status: { in: ACTIVE_STATUSES } } } },
        },
      },
      orderBy: { departureTime: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ data: { proximos: upcoming, pasados: past }, error: null });
}
