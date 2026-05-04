// Trip repository: all Prisma queries for Trip. No business logic.

import { Prisma, TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Shared select — used by every query in this file for a consistent return shape.
// Includes boat name and driver name so callers never need a second query.
// ---------------------------------------------------------------------------

const TRIP_SELECT = {
  id: true,
  companyId: true,
  branchId: true,
  boatId: true,
  driverId: true,
  departureTime: true,
  estimatedArrivalTime: true,
  status: true,
  capacity: true,
  waitlistEnabled: true,
  statusReason: true,
  notes: true,
  automatizado: true,
  horaRecurrente: true,
  createdAt: true,
  updatedAt: true,
  boat: { select: { id: true, name: true } },
  driver: { select: { id: true, firstName: true, lastName: true } },
  stops: { select: { order: true, name: true }, orderBy: { order: "asc" as const } },
} satisfies Prisma.TripSelect;

export type TripRow = Prisma.TripGetPayload<{ select: typeof TRIP_SELECT }>;

// ---------------------------------------------------------------------------
// Statuses considered "active" for passenger-facing listings by default.
// CANCELLED, DEPARTED, COMPLETED are terminal and hidden unless explicitly requested.
// ---------------------------------------------------------------------------

const NON_TERMINAL_STATUSES: TripStatus[] = [
  TripStatus.SCHEDULED,
  TripStatus.BOARDING,
  TripStatus.DELAYED,
];

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export type StopData = { order: number; name: string };

export type CreateTripData = {
  companyId: string;
  branchId: string;
  boatId: string;
  driverId?: string;
  departureTime: Date;
  estimatedArrivalTime?: Date;
  /** Snapshotted from boat.capacity by the service — never from the client. */
  capacity: number;
  waitlistEnabled: boolean;
  notes?: string;
  automatizado?: boolean;
  horaRecurrente?: string;
  stops?: StopData[];
};

export async function createTrip(data: CreateTripData): Promise<TripRow> {
  return prisma.trip.create({
    data: {
      companyId: data.companyId,
      branchId: data.branchId,
      boatId: data.boatId,
      driverId: data.driverId,
      departureTime: data.departureTime,
      estimatedArrivalTime: data.estimatedArrivalTime,
      capacity: data.capacity,
      waitlistEnabled: data.waitlistEnabled,
      notes: data.notes,
      automatizado: data.automatizado ?? false,
      horaRecurrente: data.horaRecurrente,
      stops: data.stops?.length
        ? { createMany: { data: data.stops } }
        : undefined,
    },
    select: TRIP_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export type ListTripsFilter = {
  branchId: string;
  /** If set, filters to trips whose departureTime falls within [dayStart, dayEnd). */
  dayStart?: Date;
  dayEnd?: Date;
  /** If omitted, defaults to NON_TERMINAL_STATUSES. */
  status?: TripStatus;
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Page size. Defaults to 20, max 100. */
  limit?: number;
};

export type PaginatedTrips = {
  trips: TripRow[];
  total: number;
};

export async function listTripsByBranch(
  filter: ListTripsFilter,
): Promise<PaginatedTrips> {
  const page  = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
  const skip  = (page - 1) * limit;

  const where = {
    branchId: filter.branchId,
    ...(filter.dayStart && filter.dayEnd
      ? { departureTime: { gte: filter.dayStart, lt: filter.dayEnd } }
      : {}),
    status: filter.status ? filter.status : { in: NON_TERMINAL_STATUSES },
  };

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      select:  TRIP_SELECT,
      orderBy: { createdAt: "desc" },
      skip,
      take:    limit,
    }),
    prisma.trip.count({ where }),
  ]);

  return { trips, total };
}

/** Tenant-scoped single-trip lookup. Returns null if not found or wrong company. */
export async function findTripById(
  id: string,
  companyId: string,
): Promise<TripRow | null> {
  return prisma.trip.findFirst({
    where: { id, companyId },
    select: TRIP_SELECT,
  });
}
