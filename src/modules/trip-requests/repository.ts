import { prisma } from "@/lib/prisma";
import type { TripRequest, TripRequestStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const tripRequestSelect = {
  id:             true,
  companyId:      true,
  branchId:       true,
  origin:         true,
  destination:    true,
  requestedDate:  true,
  passengerCount: true,
  notes:          true,
  status:         true,
  requestedById:  true,
  boatId:         true,
  tripId:         true,
  reviewedById:   true,
  reviewedAt:     true,
  rejectionNote:  true,
  createdAt:      true,
  updatedAt:      true,
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
    status:        TripRequestStatus;
    boatId:        string;
    tripId:        string;
    reviewedById:  string;
    reviewedAt:    Date;
    rejectionNote: string;
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
