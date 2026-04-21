// PATCH /api/notificaciones/todas — mark all notifications as read for the current user.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { marcarTodasLeidas } from "@/modules/notificaciones/service";

export async function PATCH(_req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }

  await marcarTodasLeidas(session.user.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
