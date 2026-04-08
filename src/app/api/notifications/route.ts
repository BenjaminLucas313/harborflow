// GET  /api/notifications — List notifications for the current user
// PATCH /api/notifications — Mark all as read
import { auth } from "@/lib/auth";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
} from "@/modules/notifications/service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await listNotificationsForUser(session.user.id);
  return NextResponse.json(notifications);
}

export async function PATCH() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markAllNotificationsRead(session.user.id);
  return new NextResponse(null, { status: 204 });
}
