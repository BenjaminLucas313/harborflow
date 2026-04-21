// PATCH /api/trips/[tripId] — update trip status or manage automation (PROVEEDOR only).
//
// Supported body shapes:
//   { status: TripStatus }                          — change operational status
//   { status: "CANCELLED", isDeleteRequest: true }  — cancel with cascade (GroupBookings + Slots)
//   { action: "DESAUTOMATIZAR" }                    — stop daily auto-creation for this trip's series

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TripStatus, ViajeStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/modules/audit/repository";
import { cancelTrip } from "@/modules/trips/service";
import { AppError } from "@/lib/errors";
import { crearNotificacion } from "@/modules/notificaciones/service";

const TERMINAL_VIAJE_STATUSES: TripStatus[] = [
  TripStatus.COMPLETED,
  TripStatus.DEPARTED,
];

const StatusChangeSchema = z.object({
  status:          z.enum(Object.values(TripStatus) as [string, ...string[]]),
  isDeleteRequest: z.boolean().optional(),
});

const DesautomatizarSchema = z.object({
  action: z.literal("DESAUTOMATIZAR"),
});

const BodySchema = z.union([StatusChangeSchema, DesautomatizarSchema]);

export async function PATCH(
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
  if (session.user.role !== "PROVEEDOR") {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

  const { tripId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "JSON inválido." } },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Cuerpo inválido." } },
      { status: 400 },
    );
  }

  const { companyId, id: actorId } = session.user;

  // Verify trip belongs to this company.
  const existing = await prisma.trip.findFirst({
    where:  { id: tripId, companyId },
    select: {
      id: true, status: true, automatizado: true,
      boatId: true, branchId: true, horaRecurrente: true, departureTime: true,
      boat: { select: { name: true } },
    },
  });
  if (!existing) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
      { status: 404 },
    );
  }

  // ── DESAUTOMATIZAR ────────────────────────────────────────────────────────────
  if ("action" in parsed.data && parsed.data.action === "DESAUTOMATIZAR") {
    if (!existing.automatizado || !existing.horaRecurrente) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "Este viaje no está automatizado." } },
        { status: 409 },
      );
    }

    const now = new Date();

    const result = await prisma.trip.updateMany({
      where: {
        companyId,
        boatId:         existing.boatId,
        branchId:       existing.branchId,
        horaRecurrente: existing.horaRecurrente,
        automatizado:   true,
        departureTime:  { gte: now },
      },
      data: { automatizado: false, horaRecurrente: null },
    });

    logAction({
      companyId,
      actorId,
      action:     "TRIP_DESAUTOMATIZADO",
      entityType: "Trip",
      entityId:   tripId,
      payload:    {
        boatId:         existing.boatId,
        branchId:       existing.branchId,
        horaRecurrente: existing.horaRecurrente,
        affectedCount:  result.count,
      },
    }).catch(() => {});

    return NextResponse.json({ data: { affectedCount: result.count }, error: null });
  }

  // ── STATUS CHANGE ─────────────────────────────────────────────────────────────
  const { status: newStatus, isDeleteRequest } = parsed.data as z.infer<typeof StatusChangeSchema>;

  // Cancellation uses the cascading service function.
  if (newStatus === TripStatus.CANCELLED) {
    try {
      const result = await cancelTrip(tripId, companyId, actorId, isDeleteRequest ?? false);

      // Format departure for notification messages.
      const departure = existing.departureTime.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day:      "2-digit",
        month:    "2-digit",
        year:     "numeric",
        hour:     "2-digit",
        minute:   "2-digit",
      });
      const boatName = existing.boat?.name ?? "lancha";

      // Best-effort in-app notifications for every affected USUARIO.
      for (const userId of result.affectedUserIds) {
        crearNotificacion({
          userId,
          companyId,
          tipo:      "VIAJE_CANCELADO",
          titulo:    "Viaje cancelado",
          mensaje:   `El viaje del ${departure} en ${boatName} fue cancelado.`,
          accionUrl: "/usuario/viajes",
        }).catch(() => {});
      }

      return NextResponse.json({
        data: {
          tripId:                 result.tripId,
          groupBookingsCancelled: result.groupBookingsCancelled,
          slotsCancelled:         result.slotsCancelled,
        },
        error: null,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          { data: null, error: { code: err.code, message: err.message } },
          { status: err.statusCode },
        );
      }
      return NextResponse.json(
        { data: null, error: { code: "INTERNAL_ERROR", message: "Error interno." } },
        { status: 500 },
      );
    }
  }

  // Non-cancel status transitions.
  const isTerminal = TERMINAL_VIAJE_STATUSES.includes(newStatus as TripStatus);

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data:  {
      status: newStatus as TripStatus,
      ...(isTerminal ? { viajeStatus: ViajeStatus.PASADO } : {}),
    },
    select: { id: true, status: true, viajeStatus: true },
  });

  logAction({
    companyId,
    actorId,
    action:     "TRIP_STATUS_CHANGED",
    entityType: "Trip",
    entityId:   tripId,
    payload:    { from: existing.status, to: newStatus },
  }).catch(() => {});

  return NextResponse.json({ data: { trip: updated }, error: null });
}
