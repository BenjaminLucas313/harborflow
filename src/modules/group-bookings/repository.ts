import { prisma } from "@/lib/prisma";
import type { GroupBooking, GroupBookingStatus, PassengerSlot } from "@prisma/client";

export type GroupBookingWithSlots = GroupBooking & {
  passengerSlots: PassengerSlot[];
};

export async function findGroupBookingById(
  id: string,
): Promise<GroupBookingWithSlots | null> {
  return prisma.groupBooking.findUnique({
    where:   { id },
    include: { passengerSlots: true },
  });
}

export type PaginatedGroupBookings<T> = { items: T[]; total: number };

export async function listGroupBookingsByEmployer(
  companyId: string,
  employerId: string,
  pagination?: { page?: number; limit?: number },
): Promise<PaginatedGroupBookings<GroupBooking>> {
  const page  = Math.max(1, pagination?.page  ?? 1);
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 20));
  const skip  = (page - 1) * limit;
  const where = { companyId, employerId };
  const [items, total] = await prisma.$transaction([
    prisma.groupBooking.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.groupBooking.count({ where }),
  ]);
  return { items, total };
}

export async function listGroupBookingsByTrip(
  companyId: string,
  tripId: string,
  pagination?: { page?: number; limit?: number },
): Promise<PaginatedGroupBookings<GroupBookingWithSlots>> {
  const page  = Math.max(1, pagination?.page  ?? 1);
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 20));
  const skip  = (page - 1) * limit;
  const where = { companyId, tripId };
  const [items, total] = await prisma.$transaction([
    prisma.groupBooking.findMany({
      where,
      include: { passengerSlots: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.groupBooking.count({ where }),
  ]);
  return { items, total };
}

export async function createGroupBooking(data: {
  companyId:  string;
  branchId:   string;
  tripId:     string;
  employerId: string;
  bookedById: string;
  notes?:     string;
}): Promise<GroupBooking> {
  return prisma.groupBooking.create({ data });
}

export async function updateGroupBookingStatus(
  id: string,
  status: GroupBookingStatus,
): Promise<GroupBooking> {
  return prisma.groupBooking.update({ where: { id }, data: { status } });
}

/**
 * Recomputes the GroupBooking status based on its sibling slots.
 * Called after every slot review action.
 *
 * Rules:
 *   - All CONFIRMED (or all REJECTED/CANCELLED) → CONFIRMED or CANCELLED
 *   - Any PENDING remaining → PARTIAL
 *   - Mixed (some confirmed, no pending) → CONFIRMED
 */
export async function recomputeGroupBookingStatus(
  groupBookingId: string,
): Promise<void> {
  const slots = await prisma.passengerSlot.findMany({
    where:  { groupBookingId },
    select: { status: true },
  });

  if (slots.length === 0) return;

  const hasPending  = slots.some((s) => s.status === "PENDING");
  const hasConfirmed = slots.some((s) => s.status === "CONFIRMED");
  const allCancelled = slots.every(
    (s) => s.status === "CANCELLED" || s.status === "REJECTED",
  );

  let newStatus: GroupBookingStatus;
  if (allCancelled)       newStatus = "CANCELLED";
  else if (hasPending)    newStatus = "PARTIAL";
  else if (hasConfirmed)  newStatus = "CONFIRMED";
  else                    newStatus = "CANCELLED";

  await prisma.groupBooking.update({
    where: { id: groupBookingId },
    data:  { status: newStatus },
  });
}
