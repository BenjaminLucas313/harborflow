// GET /api/notificaciones — fetch notifications for the authenticated user.
//
// Query params:
//   soloNoLeidas=true   — return only unread notifications

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNotificaciones, getContadorNoLeidas } from "@/modules/notificaciones/service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }

  const soloNoLeidas = req.nextUrl.searchParams.get("soloNoLeidas") === "true";

  const [notificaciones, noLeidas] = await Promise.all([
    getNotificaciones(session.user.id, soloNoLeidas),
    getContadorNoLeidas(session.user.id),
  ]);

  return NextResponse.json({
    data:  { notificaciones, noLeidas },
    error: null,
  });
}
