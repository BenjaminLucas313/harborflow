import { prisma } from "@/lib/prisma";
import type { Department } from "@prisma/client";

export async function findDepartmentById(id: string): Promise<Department | null> {
  return prisma.department.findUnique({ where: { id } });
}

export async function listDepartments(companyId: string): Promise<Department[]> {
  return prisma.department.findMany({
    where:   { companyId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(data: {
  companyId:   string;
  name:        string;
  description?: string;
}): Promise<Department> {
  return prisma.department.create({ data });
}

export async function updateDepartment(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean },
): Promise<Department> {
  return prisma.department.update({ where: { id }, data });
}
