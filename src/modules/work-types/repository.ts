import { prisma } from "@/lib/prisma";
import type { WorkType } from "@prisma/client";

export async function findWorkTypeById(id: string): Promise<WorkType | null> {
  return prisma.workType.findUnique({ where: { id } });
}

export async function listWorkTypes(
  companyId: string,
  departmentId?: string,
): Promise<WorkType[]> {
  return prisma.workType.findMany({
    where:   { companyId, isActive: true, ...(departmentId ? { departmentId } : {}) },
    orderBy: [{ departmentId: "asc" }, { name: "asc" }],
  });
}

export async function createWorkType(data: {
  companyId:    string;
  departmentId: string;
  name:         string;
  code:         string;
}): Promise<WorkType> {
  return prisma.workType.create({ data });
}

export async function updateWorkType(
  id: string,
  data: { name?: string; isActive?: boolean },
): Promise<WorkType> {
  return prisma.workType.update({ where: { id }, data });
}
