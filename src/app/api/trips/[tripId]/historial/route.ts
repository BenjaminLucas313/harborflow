// GET /api/trips/[tripId]/historial
// Returns paginated audit-log events for a trip (direct + via slots/bookings).
// Auth: UABL or PROVEEDOR only.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(30).default(15),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }
  if (!["UABL", "PROVEEDOR"].includes(session.user.role)) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

  const { tripId } = await params;
  const { companyId } = session.user;

  // Verify ownership before exposing audit data.
  const trip = await prisma.trip.findFirst({
    where:  { id: tripId, companyId },
    select: { id: true },
  });
  if (!trip) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
      { status: 404 },
    );
  }

  const url    = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit:  url.searchParams.get("limit")  ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos." } },
      { status: 400 },
    );
  }
  const { cursor, limit } = parsed.data;

  // Fetch IDs of entities related to this trip in parallel.
  // AuditLog has no direct relation to these models, so we resolve IDs first.
  const [slotIds, bookingIds] = await Promise.all([
    prisma.passengerSlot
      .findMany({ where: { tripId, companyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id)),
    prisma.groupBooking
      .findMany({ where: { tripId, companyId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id)),
  ]);

  const orConditions: object[] = [{ entityType: "Trip", entityId: tripId }];
  if (slotIds.length > 0)
    orConditions.push({ entityType: "PassengerSlot", entityId: { in: slotIds } });
  if (bookingIds.length > 0)
    orConditions.push({ entityType: "GroupBooking", entityId: { in: bookingIds } });

  const rows = await prisma.auditLog.findMany({
    where:   { companyId, OR: orConditions },
    select: {
      id:         true,
      action:     true,
      entityType: true,
      payload:    true,
      createdAt:  true,
      actor: { select: { firstName: true, lastName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take:    limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore    = rows.length > limit;
  const page       = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

  return NextResponse.json({ data: { eventos: page, nextCursor }, error: null });
}
