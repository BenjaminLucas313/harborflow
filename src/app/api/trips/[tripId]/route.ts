// PATCH /api/trips/[tripId] — update trip status (PROVEEDOR only)
//   Body: { status: TripStatus }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TripStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/modules/audit/repository";

const BodySchema = z.object({
  status: z.enum(Object.values(TripStatus) as [string, ...string[]]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (session.user.role !== "PROVEEDOR") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { tripId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  const { companyId, id: actorId } = session.user;

  // Verify trip belongs to this company.
  const existing = await prisma.trip.findFirst({
    where:  { id: tripId, companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Viaje no encontrado." }, { status: 404 });
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data:  { status: parsed.data.status as TripStatus },
    select: { id: true, status: true },
  });

  logAction({
    companyId,
    actorId,
    action:     "TRIP_STATUS_CHANGED",
    entityType: "Trip",
    entityId:   tripId,
    payload:    { from: existing.status, to: parsed.data.status },
  }).catch(() => {});

  return NextResponse.json({ trip: updated });
}
