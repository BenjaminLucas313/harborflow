// Allocation service: seat request lifecycle with capacity enforcement.
//
// CAPACITY ENFORCEMENT
// --------------------
// addSeatRequest acquires a row-level lock on the Trip record (FOR UPDATE)
// and counts PENDING + CONFIRMED SeatRequests before inserting. This serialises
// concurrent seat requests for the same trip.
//
// EMPLOYEE UNIQUENESS PER TRIP
// ----------------------------
// Before adding a seat, we check that the employee has no PENDING or CONFIRMED
// seat on the same trip across ANY allocation. Enforced at app layer (not DB
// index) because PostgreSQL does not support JOINs in partial index predicates.
//
// DEPARTMENT SCOPE FOR UABL
// -------------------------
// confirmSeatRequest and rejectSeatRequest verify that the acting UABL_STAFF
// member's departmentId matches the seat's departmentId. This prevents cross-
// department confirmation, which is a business rule.

import { TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { createNotification } from "@/modules/notifications/service";
import {
  findAllocationById,
  findSeatRequestById,
  listAllocationsByCompany,
  listAllocationsByTrip,
  listSeatRequestsByEmployee,
  employeeHasActiveSeatOnTrip,
  ALLOCATION_SELECT,
  SEAT_REQUEST_SELECT,
} from "./repository";
import type { AllocationRow, SeatRequestRow } from "./repository";

// Re-export for use in API routes
export type { AllocationRow, SeatRequestRow };
export { listAllocationsByCompany, listAllocationsByTrip, listSeatRequestsByEmployee };

/** Trip statuses that accept new allocations. */
const BOOKABLE_STATUSES: TripStatus[] = [
  TripStatus.SCHEDULED,
  TripStatus.BOARDING,
  TripStatus.DELAYED,
];

// ---------------------------------------------------------------------------
// Create allocation (COMPANY_REP)
// ---------------------------------------------------------------------------

export async function createAllocation(input: {
  tripId: string;
  companyId: string;
  requestedById: string;
}): Promise<AllocationRow> {
  const { tripId, companyId, requestedById } = input;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    select: { id: true, status: true, capacity: true },
  });

  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found.", 404);

  if (!BOOKABLE_STATUSES.includes(trip.status)) {
    throw new AppError(
      "TRIP_NOT_BOOKABLE",
      "This trip is not open for allocations.",
      409,
    );
  }

  const allocation = await prisma.tripAllocation.create({
    data: { tripId, companyId, requestedById, status: "DRAFT" },
    select: ALLOCATION_SELECT,
  });

  logAction({
    companyId,
    actorId: requestedById,
    action: "ALLOCATION_CREATED",
    entityType: "TripAllocation",
    entityId: allocation.id,
    payload: { tripId },
  }).catch(() => {});

  return allocation;
}

// ---------------------------------------------------------------------------
// Add seat request to a DRAFT allocation (COMPANY_REP)
// ---------------------------------------------------------------------------

type TripLockRow = { id: string; capacity: number };
type CountRow = { count: bigint };

export async function addSeatRequest(input: {
  allocationId: string;
  employeeId: string;
  workTypeId: string;
  companyId: string;
  requestedById: string;
}): Promise<SeatRequestRow> {
  const { allocationId, employeeId, workTypeId, companyId, requestedById } = input;

  // 1. Validate allocation belongs to caller's company and is in DRAFT.
  const allocation = await findAllocationById(allocationId);
  if (!allocation || allocation.companyId !== companyId) {
    throw new AppError("ALLOCATION_NOT_FOUND", "Allocation not found.", 404);
  }
  if (allocation.status !== "DRAFT") {
    throw new AppError(
      "ALLOCATION_NOT_EDITABLE",
      "Only DRAFT allocations can be modified.",
      409,
    );
  }

  // 2. Validate employee exists, is EMPLOYEE role, and belongs to same company.
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, companyId, role: "EMPLOYEE", isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    throw new AppError(
      "EMPLOYEE_NOT_FOUND",
      "Employee not found in your company.",
      404,
    );
  }

  // 3. Validate work type exists and get its departmentId.
  const workType = await prisma.workType.findFirst({
    where: { id: workTypeId, isActive: true },
    select: { id: true, departmentId: true },
  });
  if (!workType) {
    throw new AppError("WORK_TYPE_NOT_FOUND", "Work type not found.", 404);
  }

  const tripId = allocation.tripId;

  // 4. Check employee doesn't already have an active seat on this trip.
  const alreadyOnTrip = await employeeHasActiveSeatOnTrip(employeeId, tripId);
  if (alreadyOnTrip) {
    throw new AppError(
      "EMPLOYEE_ALREADY_ON_TRIP",
      `${employee.firstName} ${employee.lastName} already has a seat on this trip.`,
      409,
    );
  }

  // 5. Transactional capacity check + insert.
  const seatRequest = await prisma.$transaction(async (tx) => {
    // Lock the trip row to serialise concurrent seat additions.
    const [locked] = await tx.$queryRaw<TripLockRow[]>`
      SELECT id, capacity FROM "Trip" WHERE id = ${tripId} FOR UPDATE
    `;
    if (!locked) throw new AppError("TRIP_NOT_FOUND", "Trip not found.", 404);

    // Count PENDING + CONFIRMED seats across all allocations for this trip.
    const countRows = await tx.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "SeatRequest" sr
      JOIN "TripAllocation" ta ON ta.id = sr."allocationId"
      WHERE ta."tripId" = ${tripId}
        AND sr.status IN ('PENDING', 'CONFIRMED')
    `;
    const takenSeats = Number(countRows[0]?.count ?? 0);

    if (takenSeats >= locked.capacity) {
      throw new AppError(
        "TRIP_CAPACITY_FULL",
        "This trip has reached its maximum capacity.",
        409,
      );
    }

    return tx.seatRequest.create({
      data: {
        allocationId,
        employeeId,
        workTypeId,
        departmentId: workType.departmentId,
        status: "PENDING",
      },
      select: SEAT_REQUEST_SELECT,
    });
  });

  // 6. Notify employee of seat assignment (fire-and-forget).
  createNotification({
    userId: employeeId,
    type: "SEAT_ASSIGNED",
    payload: {
      seatRequestId: seatRequest.id,
      allocationId,
      tripId,
      departureTime: allocation.trip.departureTime,
      companyName: companyId, // enriched by notification module if needed
    },
  }).catch(() => {});

  logAction({
    companyId,
    actorId: requestedById,
    action: "EMPLOYEE_ASSIGNED",
    entityType: "SeatRequest",
    entityId: seatRequest.id,
    payload: { allocationId, employeeId, workTypeId },
  }).catch(() => {});

  return seatRequest;
}

// ---------------------------------------------------------------------------
// Remove seat request from a DRAFT or SUBMITTED allocation (COMPANY_REP)
// ---------------------------------------------------------------------------

export async function removeSeatRequest(input: {
  seatRequestId: string;
  companyId: string;
  requestedById: string;
}): Promise<void> {
  const { seatRequestId, companyId, requestedById } = input;

  const seat = await findSeatRequestById(seatRequestId);
  if (!seat) throw new AppError("SEAT_NOT_FOUND", "Seat request not found.", 404);

  const allocation = await findAllocationById(seat.allocationId);
  if (!allocation || allocation.companyId !== companyId) {
    throw new AppError("SEAT_NOT_FOUND", "Seat request not found.", 404);
  }

  if (seat.status === "CONFIRMED") {
    throw new AppError(
      "SEAT_ALREADY_CONFIRMED",
      "Cannot remove a seat that has already been confirmed by UABL.",
      409,
    );
  }

  await prisma.seatRequest.update({
    where: { id: seatRequestId },
    data: { status: "CANCELLED" },
  });

  // Notify employee their seat was cancelled.
  createNotification({
    userId: seat.employeeId,
    type: "SEAT_CANCELLED",
    payload: {
      seatRequestId,
      allocationId: seat.allocationId,
      tripId: allocation.tripId,
      departureTime: allocation.trip.departureTime,
    },
  }).catch(() => {});

  logAction({
    companyId,
    actorId: requestedById,
    action: "SEAT_CANCELLED",
    entityType: "SeatRequest",
    entityId: seatRequestId,
    payload: { allocationId: seat.allocationId },
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Submit allocation to UABL (COMPANY_REP)
// ---------------------------------------------------------------------------

export async function submitAllocation(input: {
  allocationId: string;
  companyId: string;
  requestedById: string;
}): Promise<AllocationRow> {
  const { allocationId, companyId, requestedById } = input;

  const allocation = await findAllocationById(allocationId);
  if (!allocation || allocation.companyId !== companyId) {
    throw new AppError("ALLOCATION_NOT_FOUND", "Allocation not found.", 404);
  }
  if (allocation.status !== "DRAFT") {
    throw new AppError(
      "ALLOCATION_ALREADY_SUBMITTED",
      "This allocation has already been submitted.",
      409,
    );
  }

  const activeSeatCount = allocation.seatRequests.filter(
    (s) => s.status === "PENDING",
  ).length;

  if (activeSeatCount === 0) {
    throw new AppError(
      "ALLOCATION_EMPTY",
      "Cannot submit an allocation with no seats.",
      409,
    );
  }

  const updated = await prisma.tripAllocation.update({
    where: { id: allocationId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
    select: ALLOCATION_SELECT,
  });

  logAction({
    companyId,
    actorId: requestedById,
    action: "ALLOCATION_SUBMITTED",
    entityType: "TripAllocation",
    entityId: allocationId,
    payload: { seatCount: activeSeatCount },
  }).catch(() => {});

  return updated;
}

// ---------------------------------------------------------------------------
// Confirm seat request (UABL_STAFF)
// ---------------------------------------------------------------------------

export async function confirmSeatRequest(input: {
  seatRequestId: string;
  uablStaffId: string;
  uablDepartmentId: string;
  uablCompanyId: string;
}): Promise<SeatRequestRow> {
  const { seatRequestId, uablStaffId, uablDepartmentId, uablCompanyId } = input;

  const seat = await findSeatRequestById(seatRequestId);
  if (!seat) throw new AppError("SEAT_NOT_FOUND", "Seat request not found.", 404);

  if (seat.status !== "PENDING") {
    throw new AppError(
      "SEAT_NOT_PENDING",
      `This seat is already ${seat.status.toLowerCase()}.`,
      409,
    );
  }

  // Enforce department scope: UABL staff can only confirm seats from their department.
  if (seat.departmentId !== uablDepartmentId) {
    throw new AppError(
      "DEPARTMENT_MISMATCH",
      "You can only confirm seat requests assigned to your department.",
      403,
    );
  }

  const updated = await prisma.seatRequest.update({
    where: { id: seatRequestId },
    data: {
      status: "CONFIRMED",
      confirmedById: uablStaffId,
      confirmedAt: new Date(),
    },
    select: SEAT_REQUEST_SELECT,
  });

  // Update allocation status.
  await syncAllocationStatus(seat.allocationId);

  // Notify employee.
  const allocation = await findAllocationById(seat.allocationId);
  createNotification({
    userId: seat.employeeId,
    type: "SEAT_CONFIRMED",
    payload: {
      seatRequestId,
      tripId: allocation?.tripId,
      departureTime: allocation?.trip.departureTime,
    },
  }).catch(() => {});

  logAction({
    companyId: uablCompanyId,
    actorId: uablStaffId,
    action: "SEAT_CONFIRMED",
    entityType: "SeatRequest",
    entityId: seatRequestId,
    payload: { departmentId: uablDepartmentId },
  }).catch(() => {});

  return updated;
}

// ---------------------------------------------------------------------------
// Reject seat request (UABL_STAFF)
// ---------------------------------------------------------------------------

export async function rejectSeatRequest(input: {
  seatRequestId: string;
  uablStaffId: string;
  uablDepartmentId: string;
  uablCompanyId: string;
  rejectionNote?: string;
}): Promise<SeatRequestRow> {
  const { seatRequestId, uablStaffId, uablDepartmentId, uablCompanyId, rejectionNote } = input;

  const seat = await findSeatRequestById(seatRequestId);
  if (!seat) throw new AppError("SEAT_NOT_FOUND", "Seat request not found.", 404);

  if (seat.status !== "PENDING") {
    throw new AppError(
      "SEAT_NOT_PENDING",
      `This seat is already ${seat.status.toLowerCase()}.`,
      409,
    );
  }

  if (seat.departmentId !== uablDepartmentId) {
    throw new AppError(
      "DEPARTMENT_MISMATCH",
      "You can only reject seat requests assigned to your department.",
      403,
    );
  }

  const updated = await prisma.seatRequest.update({
    where: { id: seatRequestId },
    data: {
      status: "REJECTED",
      confirmedById: uablStaffId,
      confirmedAt: new Date(),
      rejectionNote: rejectionNote ?? null,
    },
    select: SEAT_REQUEST_SELECT,
  });

  // Notify employee and company rep.
  const allocation = await findAllocationById(seat.allocationId);
  createNotification({
    userId: seat.employeeId,
    type: "SEAT_REJECTED",
    payload: {
      seatRequestId,
      tripId: allocation?.tripId,
      departureTime: allocation?.trip.departureTime,
      rejectionNote,
    },
  }).catch(() => {});

  logAction({
    companyId: uablCompanyId,
    actorId: uablStaffId,
    action: "SEAT_REJECTED",
    entityType: "SeatRequest",
    entityId: seatRequestId,
    payload: { departmentId: uablDepartmentId, rejectionNote },
  }).catch(() => {});

  return updated;
}

// ---------------------------------------------------------------------------
// Internal: sync allocation status after seat changes
// ---------------------------------------------------------------------------

async function syncAllocationStatus(allocationId: string): Promise<void> {
  const seats = await prisma.seatRequest.findMany({
    where: { allocationId },
    select: { status: true },
  });

  const active = seats.filter((s) => s.status !== "CANCELLED" && s.status !== "REJECTED");
  if (active.length === 0) return;

  const allConfirmed = active.every((s) => s.status === "CONFIRMED");
  const someConfirmed = active.some((s) => s.status === "CONFIRMED");

  const newStatus = allConfirmed
    ? "FULLY_CONFIRMED"
    : someConfirmed
      ? "PARTIALLY_CONFIRMED"
      : "SUBMITTED";

  await prisma.tripAllocation.update({
    where: { id: allocationId },
    data: { status: newStatus },
  });
}
