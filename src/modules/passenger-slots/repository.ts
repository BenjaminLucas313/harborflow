import { prisma } from "@/lib/prisma";
import type { PassengerSlot } from "@prisma/client";

export type SlotWithRelations = PassengerSlot & {
  usuario:  { firstName: string; lastName: string; email: string };
  workType: { name: string; code: string };
};

export async function findSlotById(id: string): Promise<SlotWithRelations | null> {
  return prisma.passengerSlot.findUnique({
    where:   { id },
    include: {
      usuario:  { select: { firstName: true, lastName: true, email: true } },
      workType: { select: { name: true, code: true } },
    },
  });
}

export async function listSlotsByTrip(
  companyId: string,
  tripId: string,
): Promise<SlotWithRelations[]> {
  return prisma.passengerSlot.findMany({
    where:   { companyId, tripId },
    include: {
      usuario:  { select: { firstName: true, lastName: true, email: true } },
      workType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listSlotsByDepartment(
  companyId: string,
  departmentId: string,
  tripId?: string,
): Promise<SlotWithRelations[]> {
  return prisma.passengerSlot.findMany({
    where: {
      companyId,
      departmentId,
      status: "PENDING",
      ...(tripId ? { tripId } : {}),
    },
    include: {
      usuario:  { select: { firstName: true, lastName: true, email: true } },
      workType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listSlotsByUsuario(
  companyId: string,
  usuarioId: string,
): Promise<SlotWithRelations[]> {
  return prisma.passengerSlot.findMany({
    where:   { companyId, usuarioId, status: { in: ["PENDING", "CONFIRMED"] } },
    include: {
      usuario:  { select: { firstName: true, lastName: true, email: true } },
      workType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
