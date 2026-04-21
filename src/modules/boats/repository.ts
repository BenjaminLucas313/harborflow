// Boat repository: all Prisma queries for Boat. No business logic.

import { prisma } from "@/lib/prisma";
import type { CreateBoatInput } from "./schema";

export async function createBoat(input: CreateBoatInput) {
  return prisma.boat.create({ data: input });
}

export async function listBoatsByBranch(companyId: string, branchId?: string) {
  return prisma.boat.findMany({
    where: {
      companyId,
      ...(branchId ? { branchId } : {}),
      isActive: true,
    },
    select: {
      id:          true,
      name:        true,
      capacity:    true,
      description: true,
      branch:      { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function findBoatById(id: string, companyId: string) {
  return prisma.boat.findFirst({ where: { id, companyId } });
}
