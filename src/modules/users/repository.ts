// User repository: all Prisma queries for User. No business logic.
// passwordHash is never included in select projections that leave this file.

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// Fields safe to return to the service / caller. passwordHash excluded.
const SAFE_USER_SELECT = {
  id:           true,
  companyId:    true,
  branchId:     true,
  email:        true,
  firstName:    true,
  lastName:     true,
  phone:        true,
  role:         true,
  isActive:     true,
  createdAt:    true,
  // V2 additions
  departmentId: true,
  employerId:   true,
  isUablAdmin:  true,
} as const;

export type SafeUser = {
  id:           string;
  companyId:    string;
  branchId:     string | null;
  email:        string;
  firstName:    string;
  lastName:     string;
  phone:        string | null;
  role:         UserRole;
  isActive:     boolean;
  createdAt:    Date;
  departmentId: string | null;
  employerId:   string | null;
  isUablAdmin:  boolean;
};

/** Minimal type returned by searchUsuarios — no email for privacy. */
export type UsuarioSearchResult = {
  id:        string;
  firstName: string;
  lastName:  string;
};

/**
 * Returns a minimal record (id only) if the email is already registered within
 * the given company, or null if the slot is free.
 */
export async function findByCompanyAndEmail(
  companyId: string,
  email: string,
): Promise<{ id: string } | null> {
  return prisma.user.findUnique({
    where: { companyId_email: { companyId, email } },
    select: { id: true },
  });
}

export type CreateUserData = {
  companyId:    string;
  branchId?:    string;
  email:        string;
  passwordHash: string;
  firstName:    string;
  lastName:     string;
  phone?:       string;
  role:         UserRole;
  departmentId?: string;
  employerId?:   string;
  isUablAdmin?:  boolean;
};

/** Inserts a new user row and returns safe fields (no passwordHash). */
export async function createUser(data: CreateUserData): Promise<SafeUser> {
  return prisma.user.create({
    data: {
      companyId:    data.companyId,
      branchId:     data.branchId,
      email:        data.email,
      passwordHash: data.passwordHash,
      firstName:    data.firstName,
      lastName:     data.lastName,
      phone:        data.phone,
      role:         data.role,
      departmentId: data.departmentId,
      employerId:   data.employerId,
      isUablAdmin:  data.isUablAdmin ?? false,
    },
    select: SAFE_USER_SELECT,
  });
}

/**
 * Live search for USUARIO accounts by name within a company.
 * Used by EMPRESA users when assembling passenger lists.
 * Returns id + name only — email is intentionally excluded for privacy.
 */
export async function searchUsuarios(
  companyId: string,
  query: string,
): Promise<UsuarioSearchResult[]> {
  return prisma.$queryRaw<UsuarioSearchResult[]>`
    SELECT id, "firstName", "lastName"
    FROM "User"
    WHERE "companyId" = ${companyId}
      AND role = 'USUARIO'
      AND "isActive" = true
      AND (
        "firstName" ILIKE ${'%' + query + '%'}
        OR "lastName" ILIKE ${'%' + query + '%'}
        OR ("firstName" || ' ' || "lastName") ILIKE ${'%' + query + '%'}
      )
    ORDER BY "firstName", "lastName"
    LIMIT 10
  `;
}
