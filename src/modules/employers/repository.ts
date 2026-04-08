import { prisma } from "@/lib/prisma";
import type { Employer } from "@prisma/client";

export async function findEmployerById(id: string): Promise<Employer | null> {
  return prisma.employer.findUnique({ where: { id } });
}

export async function listEmployers(companyId: string): Promise<Employer[]> {
  return prisma.employer.findMany({
    where:   { companyId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createEmployer(data: {
  companyId: string;
  name:      string;
  taxId?:    string;
}): Promise<Employer> {
  return prisma.employer.create({ data });
}

export async function updateEmployer(
  id: string,
  data: { name?: string; taxId?: string; isActive?: boolean },
): Promise<Employer> {
  return prisma.employer.update({ where: { id }, data });
}
