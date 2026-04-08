// Department and WorkType read queries.
// Used by COMPANY_REP when selecting work types for seat assignments,
// and by UABL for department-scoped queries.
import { prisma } from "@/lib/prisma";

export async function listActiveDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      workTypes: {
        where: { isActive: true },
        select: { id: true, name: true, departmentId: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function listActiveWorkTypes() {
  return prisma.workType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });
}
