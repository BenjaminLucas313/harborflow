// Port status repository: append and query PortStatus records.
// Current status = most recent record by createdAt DESC for a branchId.
// No business logic.
import { prisma } from "@/lib/prisma";
import type { SetPortStatusInput } from "./schema";

export async function appendPortStatus(data: SetPortStatusInput) {
  return prisma.portStatus.create({
    data: {
      companyId: data.companyId,
      branchId: data.branchId,
      status: data.status as import("@prisma/client").PortStatusValue,
      message: data.message,
      estimatedReopeningAt: data.estimatedReopeningAt,
      setByUserId: data.setByUserId,
    },
    select: {
      id: true,
      status: true,
      message: true,
      estimatedReopeningAt: true,
      createdAt: true,
    },
  });
}

export async function getCurrentPortStatus(branchId: string) {
  return prisma.portStatus.findFirst({
    where: { branchId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      message: true,
      estimatedReopeningAt: true,
      createdAt: true,
    },
  });
}
