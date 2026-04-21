// Auth service: public registration flow.
// Resolves companySlug → companyId, then delegates to users/service.
// Role is always USUARIO for self-registration (V2); admin-created users go through users/service directly.

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createUser } from "@/modules/users/service";
import type { SafeUser } from "@/modules/users/repository";
import type { RegisterInput } from "./schema";

/**
 * Public self-registration. Creates a USUARIO account.
 *
 * Steps:
 *   1. Resolve companySlug → company (must exist and be active).
 *   2. Delegate to users/service.createUser with role locked to USUARIO.
 *
 * Throws:
 *   COMPANY_NOT_FOUND (404)       — slug unknown or company inactive
 *   EMAIL_ALREADY_REGISTERED (409) — email already taken within this company
 */
export async function registerPassenger(input: RegisterInput): Promise<SafeUser> {
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
    companyId:   company.id,
    email:       input.email,
    password:    input.password,
    firstName:   input.firstName,
    lastName:    input.lastName,
    phone:       input.phone,
    role:        "USUARIO",
    isUablAdmin: false,
  });
}
