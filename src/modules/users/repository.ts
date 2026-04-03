// User repository: all Prisma queries for User. No business logic.
// passwordHash is never included in select projections that leave this file.

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// Fields safe to return to the service / caller. passwordHash excluded.
const SAFE_USER_SELECT = {
  id: true,
  companyId: true,
  branchId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export type SafeUser = {
  id: string;
  companyId: string;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

/**
 * Returns a minimal record (id only) if the email is already registered within
 * the given company, or null if the slot is free.
 * Used for duplicate detection before insert.
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
  companyId: string;
  branchId?: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
};

/**
 * Inserts a new user row and returns safe fields (no passwordHash).
 * Callers must hash the password before passing it here.
 */
export async function createUser(data: CreateUserData): Promise<SafeUser> {
  return prisma.user.create({
    data: {
      companyId: data.companyId,
      branchId: data.branchId,
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role,
    },
    select: SAFE_USER_SELECT,
  });
}
