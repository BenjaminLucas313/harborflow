// Role-gate helpers: assertRole, canAccess. Used by route handlers and server actions.
import { UserRole } from "@prisma/client";
import { AppError } from "./errors";

// Throws FORBIDDEN if the session user's role is not in the allowed set.
export function assertRole(
  userRole: UserRole,
  allowed: UserRole[],
): void {
  if (!allowed.includes(userRole)) {
    throw new AppError("FORBIDDEN", "Insufficient role.", 403);
  }
}

// Returns true if the role is in the allowed set. Non-throwing variant for conditional rendering.
export function hasRole(userRole: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(userRole);
}
