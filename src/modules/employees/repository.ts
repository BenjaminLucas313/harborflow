// Employee search — used by COMPANY_REP when filling the seat allocation modal.
import { prisma } from "@/lib/prisma";

export type EmployeeSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

/**
 * Full-name + email search within an employer company.
 * Case-insensitive ILIKE on firstName, lastName, and email.
 * Returns at most `limit` results, ordered by first + last name.
 */
export async function searchEmployees(
  query: string,
  companyId: string,
  limit = 10,
): Promise<EmployeeSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  return prisma.user.findMany({
    where: {
      companyId,
      role: "EMPLOYEE",
      isActive: true,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: limit,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function findEmployeeById(
  id: string,
  companyId: string,
): Promise<EmployeeSearchResult | null> {
  return prisma.user.findFirst({
    where: { id, companyId, role: "EMPLOYEE", isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
}
