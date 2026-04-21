// User service: create, search. Enforces per-company email uniqueness.
// Owns password hashing — the repository only receives the final hash.

import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  findByCompanyAndEmail,
  createUser as repoCreateUser,
  searchUsuarios as repoSearchUsuarios,
} from "./repository";
import type { SafeUser, UsuarioSearchResult } from "./repository";
import type { CreateUserInput } from "./schema";

// 12 rounds: ~250 ms on modern hardware. Safe default for production.
const BCRYPT_ROUNDS = 12;

/**
 * Creates a new user within a company.
 *
 * Throws:
 *   EMAIL_ALREADY_REGISTERED (409) — email taken within this company
 */
export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  const existing = await findByCompanyAndEmail(input.companyId, input.email);
  if (existing) {
    throw new AppError(
      "EMAIL_ALREADY_REGISTERED",
      "Este email ya está registrado en esta empresa.",
      409,
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return repoCreateUser({
    companyId:    input.companyId,
    branchId:     input.branchId,
    email:        input.email,
    passwordHash,
    firstName:    input.firstName,
    lastName:     input.lastName,
    phone:        input.phone,
    role:         input.role as UserRole,
    departmentId: input.departmentId,
    employerId:   input.employerId,
    isUablAdmin:  input.isUablAdmin,
  });
}

/**
 * Live-search USUARIO accounts by name within a company.
 * Used by EMPRESA users in the passenger assignment modal.
 * Returns only id + name — email intentionally excluded for privacy.
 *
 * @param companyId - tenant scope
 * @param query     - partial first/last name or full name
 */
export async function searchUsuarios(
  companyId: string,
  query: string,
): Promise<UsuarioSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return repoSearchUsuarios(companyId, trimmed);
}
