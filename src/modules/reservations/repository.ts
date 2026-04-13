// Reservation repository: all Prisma queries for Reservation and WaitlistEntry.
// No business logic. Capacity-critical writes live in the service inside transactions.

import { Prisma, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Select shapes
// Exported so the service can reuse them inside transaction clients.
// ---------------------------------------------------------------------------

export const RESERVATION_SELECT = {
  id: true,
  companyId: true,
  branchId: true,
  userId: true,
  tripId: true,
  status: true,
  replacesReservationId: true,
  createdAt: true,
  updatedAt: true,
  trip: {
    select: {
      id: true,
      departureTime: true,
      estimatedArrivalTime: true,
      status: true,
      capacity: true,
      boat: { select: { id: true, name: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ReservationSelect;

export const WAITLIST_SELECT = {
  id: true,
  companyId: true,
  branchId: true,
  userId: true,
  tripId: true,
  position: true,
  status: true,
  promotedToReservationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WaitlistEntrySelect;

export type ReservationRow = Prisma.ReservationGetPayload<{
  select: typeof RESERVATION_SELECT;
}>;

export type WaitlistEntryRow = Prisma.WaitlistEntryGetPayload<{
  select: typeof WAITLIST_SELECT;
}>;

// ---------------------------------------------------------------------------
// Active status sets (shared across read queries)
// ---------------------------------------------------------------------------

/** Statuses that represent an active hold on a seat or queue position. */
export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.WAITLISTED,
];

// ---------------------------------------------------------------------------
// Read — Reservations
// ---------------------------------------------------------------------------

/**
 * Returns a reservation by ID, scoped to user + company.
 * Used for ownership verification before cancellation.
 */
export async function findReservationById(
  id: string,
  userId: string,
  companyId: string,
): Promise<ReservationRow | null> {
  return prisma.reservation.findFirst({
    where: { id, userId, companyId },
    select: RESERVATION_SELECT,
  });
}

/**
 * Returns a WaitlistEntry by ID, scoped to user + company.
 * Used for ownership verification before leaving the waitlist.
 */
export async function findWaitlistEntryById(
  id: string,
  userId: string,
  companyId: string,
): Promise<WaitlistEntryRow | null> {
  return prisma.waitlistEntry.findFirst({
    where: { id, userId, companyId },
    select: WAITLIST_SELECT,
  });
}

/**
 * Returns an active (CONFIRMED | CHECKED_IN | WAITLISTED) reservation for the
 * given user on a specific trip, or null if none exists.
 * Used to prevent duplicate bookings before entering the transaction.
 */
export async function findActiveReservationByUserAndTrip(
  userId: string,
  tripId: string,
): Promise<ReservationRow | null> {
  return prisma.reservation.findFirst({
    where: { userId, tripId, status: { in: ACTIVE_RESERVATION_STATUSES } },
    select: RESERVATION_SELECT,
  });
}

/**
 * Returns all active reservations for a passenger, ordered newest first.
 * Scoped by companyId to prevent cross-tenant leaks.
 */
export async function listReservationsByUser(
  userId: string,
  companyId: string,
): Promise<ReservationRow[]> {
  return prisma.reservation.findMany({
    where: {
      userId,
      companyId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
    },
    select: RESERVATION_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns all active reservations for a trip (operator/admin manifest).
 * Ordered by creation time so the manifest is stable.
 */
export async function listReservationsByTrip(
  tripId: string,
  companyId: string,
): Promise<ReservationRow[]> {
  return prisma.reservation.findMany({
    where: { tripId, companyId, status: { in: ACTIVE_RESERVATION_STATUSES } },
    select: RESERVATION_SELECT,
    orderBy: { createdAt: "desc" },
  });
}
