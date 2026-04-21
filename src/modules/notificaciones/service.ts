// Notificaciones service — in-app inbox for all roles.
//
// Design notes:
//   - Notifications are append-only; never deleted, only marked as read.
//   - crearNotificacion is safe to call fire-and-forget (.catch(() => {})).
//   - getNotificaciones caps at 50 most recent to keep payloads small.

import { prisma } from "@/lib/prisma";
import type { Notificacion } from "@prisma/client";

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type CrearNotificacionInput = {
  userId:    string;
  companyId: string;
  tipo:      string;
  titulo:    string;
  mensaje:   string;
  accionUrl?: string;
};

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function crearNotificacion(
  input: CrearNotificacionInput,
): Promise<Notificacion> {
  return prisma.notificacion.create({
    data: {
      userId:    input.userId,
      companyId: input.companyId,
      tipo:      input.tipo,
      titulo:    input.titulo,
      mensaje:   input.mensaje,
      accionUrl: input.accionUrl ?? null,
    },
  });
}

export async function marcarLeida(
  notificacionId: string,
  userId: string,
): Promise<Notificacion | null> {
  // Scoped to the owner — safe against cross-user updates.
  return prisma.notificacion.updateMany({
    where: { id: notificacionId, userId },
    data:  { leida: true },
  }).then(() =>
    prisma.notificacion.findFirst({ where: { id: notificacionId, userId } }),
  );
}

export async function marcarTodasLeidas(userId: string): Promise<void> {
  await prisma.notificacion.updateMany({
    where: { userId, leida: false },
    data:  { leida: true },
  });
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function getNotificaciones(
  userId: string,
  soloNoLeidas = false,
): Promise<Notificacion[]> {
  return prisma.notificacion.findMany({
    where: {
      userId,
      ...(soloNoLeidas ? { leida: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    50,
  });
}

export async function getContadorNoLeidas(userId: string): Promise<number> {
  return prisma.notificacion.count({
    where: { userId, leida: false },
  });
}
