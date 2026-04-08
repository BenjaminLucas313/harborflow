// Role-gate helpers: assertRole, hasRole, assertDepartment.
// Used by route handlers and server actions.
import { UserRole } from "@prisma/client";
import { AppError } from "./errors";

/** Throws FORBIDDEN if the session user's role is not in the allowed set. */
export function assertRole(
  userRole: UserRole,
  allowed: UserRole[],
): void {
  if (!allowed.includes(userRole)) {
    throw new AppError("FORBIDDEN", "Insufficient role.", 403);
  }
}

/** Returns true if the role is in the allowed set. Non-throwing variant for conditional rendering. */
export function hasRole(userRole: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(userRole);
}

/**
 * Asserts that a UABL user is authorized to review a slot.
 * A UABL user can only review slots whose departmentId matches their own.
 *
 * @param userDepartmentId  - session.user.departmentId (null if unassigned)
 * @param slotDepartmentId  - the departmentId on the PassengerSlot being reviewed
 */
export function assertDepartment(
  userDepartmentId: string | null,
  slotDepartmentId: string,
): void {
  if (!userDepartmentId || userDepartmentId !== slotDepartmentId) {
    throw new AppError(
      "UNAUTHORIZED_DEPARTMENT",
      "No tiene autorización para revisar slots de este departamento.",
      403,
    );
  }
}

/**
 * Asserts that a UABL user has the admin sub-role.
 * Used to protect department and work type management endpoints.
 */
export function assertUablAdmin(isUablAdmin: boolean): void {
  if (!isUablAdmin) {
    throw new AppError(
      "FORBIDDEN",
      "Se requiere rol de administrador UABL para esta acción.",
      403,
    );
  }
}
