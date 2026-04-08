// Auth service: employee self-registration flow (V2).
// Resolves companySlug → companyId, then delegates to users/service.
//
// In V2, self-registration creates an EMPLOYEE account.
// COMPANY_REP, UABL_STAFF, and PROVIDER accounts are created by administrators
// directly via the user management interface, not through public registration.
//
// The old registerPassenger function is kept as an alias for backwards
// compatibility with any call sites that have not yet been updated.

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createUser } from "@/modules/users/service";
import type { SafeUser } from "@/modules/users/repository";
import type { RegisterInput } from "./schema";

/**
 * Public employee self-registration.
 *
 * Steps:
 *   1. Resolve companySlug → company (must exist and be active).
 *   2. Delegate to users/service.createUser with role locked to EMPLOYEE.
 *
 * Throws:
 *   COMPANY_NOT_FOUND (404)        — slug unknown or company inactive
 *   EMAIL_ALREADY_REGISTERED (409) — email already taken within this company
 */
export async function registerEmployee(input: RegisterInput): Promise<SafeUser> {
  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
    select: { id: true, isActive: true },
  });

  if (!company?.isActive) {
    throw new AppError(
      "COMPANY_NOT_FOUND",
      "Empresa no encontrada o inactiva.",
      404,
    );
  }

  return createUser({
    companyId: company.id,
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    role: "EMPLOYEE",
  });
}

/** @deprecated Use registerEmployee instead. */
export const registerPassenger = registerEmployee;
