// PATCH /api/notificaciones/[id] — mark a single notification as read.
// Only the owner can mark their own notifications.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { marcarLeida } from "@/modules/notificaciones/service";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const notificacion = await marcarLeida(id, session.user.id);

  if (!notificacion) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Notificación no encontrada." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: { notificacion }, error: null });
}
