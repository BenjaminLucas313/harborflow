import { prisma } from "@/lib/prisma";
import type { TripRequest, TripRequestStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const tripRequestSelect = {
  id:                   true,
  companyId:            true,
  branchId:             true,
  origin:               true,
  destination:          true,
  requestedDate:        true,
  passengerCount:       true,
  notes:                true,
  status:               true,
  requestedById:        true,
  boatId:               true,
  tripId:               true,
  reviewedById:         true,
  reviewedAt:           true,
  rejectionNote:        true,
  motivoCancelacion:    true,
  createdAt:            true,
  updatedAt:            true,
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  boat: {
    select: { id: true, name: true, capacity: true },
  },
  reviewedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export type TripRequestWithRelations = TripRequest & {
  requestedBy: { id: string; firstName: string; lastName: string; email: string };
  boat:        { id: string; name: string; capacity: number } | null;
  reviewedBy:  { id: string; firstName: string; lastName: string } | null;
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type CreateTripRequestData = {
  companyId:      string;
  origin:         string;
  destination:    string;
  requestedDate:  Date;
  passengerCount: number;
  notes?:         string;
  requestedById:  string;
};

export async function createTripRequest(
  data: CreateTripRequestData,
): Promise<TripRequestWithRelations> {
  return prisma.tripRequest.create({
    data: {
      company:        { connect: { id: data.companyId } },
      origin:         data.origin,
      destination:    data.destination,
      requestedDate:  data.requestedDate,
      passengerCount: data.passengerCount,
      notes:          data.notes,
      requestedBy:    { connect: { id: data.requestedById } },
    },
    select: tripRequestSelect,
  }) as unknown as TripRequestWithRelations;
}

export async function updateTripRequest(
  id: string,
  data: Partial<{
    status:             TripRequestStatus;
    boatId:             string;
    tripId:             string;
    reviewedById:       string;
    reviewedAt:         Date;
    rejectionNote:      string;
    motivoCancelacion:  string;
  }>,
): Promise<TripRequestWithRelations> {
  return prisma.tripRequest.update({
    where: { id },
    data,
    select: tripRequestSelect,
  }) as unknown as TripRequestWithRelations;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function findTripRequestById(
  id: string,
  companyId: string,
): Promise<TripRequestWithRelations | null> {
  return prisma.tripRequest.findFirst({
    where:  { id, companyId },
    select: tripRequestSelect,
  }) as unknown as TripRequestWithRelations | null;
}

export async function listTripRequestsByRequester(
  companyId:     string,
  requestedById: string,
): Promise<TripRequestWithRelations[]> {
  return prisma.tripRequest.findMany({
    where:   { companyId, requestedById },
    orderBy: { createdAt: "desc" },
    select:  tripRequestSelect,
  }) as unknown as TripRequestWithRelations[];
}

export async function listTripRequestsByCompany(
  companyId: string,
  status?:   TripRequestStatus,
): Promise<TripRequestWithRelations[]> {
  return prisma.tripRequest.findMany({
    where:   { companyId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    select:  tripRequestSelect,
  }) as unknown as TripRequestWithRelations[];
}

// ---------------------------------------------------------------------------
// Paginated reads — used by list pages
// ---------------------------------------------------------------------------

type PagedResult = { data: TripRequestWithRelations[]; total: number };

/** EMPRESA: future solicitudes (requestedDate > now), ascending. */
export async function listActivasByRequesterPaginated(
  companyId:     string,
  requestedById: string,
  skip:          number,
  take:          number,
): Promise<PagedResult> {
  const now   = new Date();
  const where = { companyId, requestedById, requestedDate: { gt: now } };
  const [data, total] = await Promise.all([
    prisma.tripRequest.findMany({ where, orderBy: { requestedDate: "asc" }, skip, take, select: tripRequestSelect }),
    prisma.tripRequest.count({ where }),
  ]);
  return { data: data as unknown as TripRequestWithRelations[], total };
}

/** EMPRESA: past solicitudes (requestedDate <= now), descending. */
export async function listHistorialByRequesterPaginated(
  companyId:     string,
  requestedById: string,
  skip:          number,
  take:          number,
): Promise<PagedResult> {
  const now   = new Date();
  const where = { companyId, requestedById, requestedDate: { lte: now } };
  const [data, total] = await Promise.all([
    prisma.tripRequest.findMany({ where, orderBy: { requestedDate: "desc" }, skip, take, select: tripRequestSelect }),
    prisma.tripRequest.count({ where }),
  ]);
  return { data: data as unknown as TripRequestWithRelations[], total };
}

/** PROVEEDOR: PENDING requests with future requestedDate (actionable), ascending. */
export async function listPendingByCompanyPaginated(
  companyId: string,
  skip:      number,
  take:      number,
): Promise<PagedResult> {
  const now   = new Date();
  const where = { companyId, status: "PENDING" as TripRequestStatus, requestedDate: { gt: now } };
  const [data, total] = await Promise.all([
    prisma.tripRequest.findMany({ where, orderBy: { requestedDate: "asc" }, skip, take, select: tripRequestSelect }),
    prisma.tripRequest.count({ where }),
  ]);
  return { data: data as unknown as TripRequestWithRelations[], total };
}

/** PROVEEDOR: historial = resolved OR expired PENDING (requestedDate <= now), descending. */
export async function listHistorialByCompanyPaginated(
  companyId: string,
  skip:      number,
  take:      number,
): Promise<PagedResult> {
  const now   = new Date();
  const where = {
    companyId,
    OR: [
      { status: { not: "PENDING" as TripRequestStatus } },
      { status: "PENDING" as TripRequestStatus, requestedDate: { lte: now } },
    ],
  };
  const [data, total] = await Promise.all([
    prisma.tripRequest.findMany({ where, orderBy: { requestedDate: "desc" }, skip, take, select: tripRequestSelect }),
    prisma.tripRequest.count({ where }),
  ]);
  return { data: data as unknown as TripRequestWithRelations[], total };
}
