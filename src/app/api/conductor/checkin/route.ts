// PATCH /api/conductor/checkin
// Marks a passenger as present or absent in the boarding checklist.
// Only the conductor assigned to the trip may call this endpoint.

import { NextRequest, NextResponse } from "next/server";
import { z }                          from "zod";
import { SlotStatus }                 from "@prisma/client";
import { auth }                       from "@/lib/auth";
import { prisma }                     from "@/lib/prisma";
import { logAction }                  from "@/modules/audit/repository";

const BodySchema = z.object({
  tripId:   z.string().min(1),
  userId:   z.string().min(1),
  presente: z.boolean(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
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

  let body: unknown;
  try { body = await req.json(); }
  catch {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "JSON inválido." } },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Datos inválidos." } },
      { status: 400 },
    );
  }

  const { tripId, userId, presente } = parsed.data;
  const { companyId, id: conductorUserId } = session.user;

  // Find the Driver profile linked to this session.
  const driver = await prisma.driver.findFirst({
    where:  { userId: conductorUserId, isActive: true },
    select: { id: true },
  });
  if (!driver) {
    return NextResponse.json(
      { data: null, error: { code: "DRIVER_NOT_LINKED", message: "Tu cuenta no está vinculada a un perfil de conductor." } },
      { status: 403 },
    );
  }

  // Verify the trip exists and belongs to this company.
  const trip = await prisma.trip.findFirst({
    where:  { id: tripId, companyId },
    select: { id: true, driverId: true, salidaConfirmada: true },
  });
  if (!trip) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
      { status: 404 },
    );
  }

  // Only the assigned conductor may submit checkins.
  if (trip.driverId !== driver.id) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "No estás asignado a este viaje." } },
      { status: 403 },
    );
  }

  // Departure already confirmed — checklist is locked.
  if (trip.salidaConfirmada) {
    return NextResponse.json(
      { data: null, error: { code: "CONFLICT", message: "La salida ya fue confirmada. No se puede modificar el checklist." } },
      { status: 409 },
    );
  }

  // Verify the passenger has a CONFIRMED slot on this trip.
  const slot = await prisma.passengerSlot.findFirst({
    where: { tripId, usuarioId: userId, companyId, status: SlotStatus.CONFIRMED },
    select: { id: true },
  });
  if (!slot) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "El pasajero no tiene un asiento confirmado en este viaje." } },
      { status: 404 },
    );
  }

  // Upsert the check-in record.
  const checkin = await prisma.conductorCheckin.upsert({
    where:  { tripId_userId: { tripId, userId } },
    create: {
      companyId,
      tripId,
      userId,
      conductorId: conductorUserId,
      presente,
      checkedAt:   presente ? new Date() : null,
    },
    update: {
      presente,
      conductorId: conductorUserId,
      checkedAt:   presente ? new Date() : null,
    },
    select: { id: true, presente: true, checkedAt: true },
  });

  logAction({
    companyId,
    actorId:    conductorUserId,
    action:     "CONDUCTOR_CHECKIN",
    entityType: "ConductorCheckin",
    entityId:   checkin.id,
    payload:    { tripId, userId, presente },
  }).catch(() => {});

  return NextResponse.json({ data: checkin, error: null });
}
