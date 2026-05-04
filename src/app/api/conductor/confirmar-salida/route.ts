// POST /api/conductor/confirmar-salida
// Records departure confirmation by the assigned conductor.
// Idempotent: returns success if already confirmed.
// Sends in-app notifications to all UABL and PROVEEDOR users in the company.

import { NextRequest, NextResponse } from "next/server";
import { z }                          from "zod";
import { auth }                       from "@/lib/auth";
import { prisma }                     from "@/lib/prisma";
import { logAction }                  from "@/modules/audit/repository";
import { crearNotificacion }          from "@/modules/notificaciones/service";

const ARG_TZ = "America/Argentina/Buenos_Aires";

const BodySchema = z.object({
  tripId: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
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
      { data: null, error: { code: "VALIDATION_ERROR", message: "Datos inválidos." } },
      { status: 400 },
    );
  }

  const { tripId } = parsed.data;
  const { companyId, id: conductorUserId } = session.user;

  // Find the Driver profile linked to this conductor.
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

  // Load trip with all data needed for the confirmation and notifications.
  const trip = await prisma.trip.findFirst({
    where:  { id: tripId, companyId },
    select: {
      id:               true,
      driverId:         true,
      salidaConfirmada: true,
      salidaConfirmadaAt: true,
      departureTime:    true,
      capacity:         true,
      boat:   { select: { name: true } },
      _count: {
        select: {
          conductorCheckins: { where: { companyId, presente: true } },
          passengerSlots:    { where: { companyId, status: "CONFIRMED" } },
        },
      },
    },
  });

  if (!trip) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
      { status: 404 },
    );
  }

  // Only the assigned conductor may confirm departure.
  if (trip.driverId !== driver.id) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "No estás asignado a este viaje." } },
      { status: 403 },
    );
  }

  // Idempotency: if already confirmed, return existing timestamp.
  if (trip.salidaConfirmada && trip.salidaConfirmadaAt) {
    return NextResponse.json({
      data: { salidaConfirmadaAt: trip.salidaConfirmadaAt.toISOString() },
      error: null,
    });
  }

  const now = new Date();

  // Confirm departure on the trip and close its liquidation lifecycle.
  const updated = await prisma.trip.update({
    where: { id: tripId },
    data:  {
      salidaConfirmada:   true,
      salidaConfirmadaAt: now,
      salidaConfirmadaBy: conductorUserId,
      viajeStatus:        "PASADO",
    },
    select: { salidaConfirmadaAt: true },
  });

  // Counts for notification message.
  const presentCount = trip._count.conductorCheckins;
  const totalSlots   = trip._count.passengerSlots;

  const depFormatted = new Date(trip.departureTime).toLocaleString("es-AR", {
    timeZone: ARG_TZ,
    day:      "2-digit",
    month:    "2-digit",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });

  const horaPartida = now.toLocaleTimeString("es-AR", {
    timeZone: ARG_TZ,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });

  const titulo  = "Viaje confirmado — partió";
  const mensaje = `El viaje del ${depFormatted} en ${trip.boat.name} partió a las ${horaPartida}. Pasajeros: ${presentCount}/${totalSlots} presentes.`;

  // Send notifications to all UABL and PROVEEDOR users (best-effort, fire-and-forget).
  prisma.user.findMany({
    where:  { companyId, role: { in: ["UABL", "PROVEEDOR"] }, isActive: true },
    select: { id: true, role: true },
    take:   100,
  }).then((users) => {
    for (const u of users) {
      const accionUrl = u.role === "UABL" ? "/uabl/viajes" : "/proveedor/viajes";
      crearNotificacion({ userId: u.id, companyId, tipo: "VIAJE_PARTIO", titulo, mensaje, accionUrl })
        .catch(() => {});
    }
  }).catch(() => {});

  logAction({
    companyId,
    actorId:    conductorUserId,
    action:     "SALIDA_CONFIRMADA",
    entityType: "Trip",
    entityId:   tripId,
    payload:    {
      presentCount,
      totalSlots,
      horaPartida,
      boatName: trip.boat.name,
    },
  }).catch(() => {});

  return NextResponse.json({
    data:  { salidaConfirmadaAt: updated.salidaConfirmadaAt!.toISOString() },
    error: null,
  });
}
