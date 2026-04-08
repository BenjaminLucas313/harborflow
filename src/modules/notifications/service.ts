// Notification service — fire-and-forget pattern.
//
// Notifications are created asynchronously and must never block the main
// booking/confirmation flow. Callers should use `.catch(() => {})` when
// calling createNotification.
//
// The payload contains all data needed to compose an email without extra
// DB queries: tripId, departureTime, companyName, seatRequestId, etc.
//
// V2 EMAIL EXTENSION:
// A cron job or background worker can read Notification rows where readAt IS NULL
// and createdAt < (now - 2 minutes), compose an email from the payload, send it,
// and mark notifiedAt on SeatRequest. This is not wired in V1 — the model
// supports it without schema changes.

import { prisma } from "@/lib/prisma";

export type NotificationPayload = Record<string, unknown>;

export type NotificationType =
  | "SEAT_ASSIGNED"
  | "SEAT_CONFIRMED"
  | "SEAT_REJECTED"
  | "SEAT_CANCELLED";

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  payload: NotificationPayload;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: input.payload,
    },
  });
}

export async function listNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
