// Centralised route constants and role-to-dashboard mapping.
// Imported by both middleware (Edge) and server layouts — keep this file free
// of Node.js-only imports so it remains Edge-compatible.

import type { UserRole } from "@prisma/client";

/** Routes that are always reachable without authentication. */
export const PUBLIC_ROUTES: string[] = ["/", "/login", "/register"];

/** The fallback path when an unauthenticated user hits a protected route. */
export const LOGIN_PATH = "/login";

/** Root path for each role's dashboard. */
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  PASSENGER: "/passenger",
  OPERATOR: "/operator",
  ADMIN: "/admin",
};

/**
 * Returns the dashboard path for the given role.
 * Falls back to "/" so a totally unknown future role degrades gracefully.
 */
export function dashboardForRole(role: UserRole): string {
  return ROLE_DASHBOARD[role] ?? "/";
}

/**
 * Returns true when `pathname` is accessible to `role`.
 * Used in middleware to decide whether to redirect a user who is authenticated
 * but accessing the wrong role's section.
 *
 * ADMINs have company-wide access and may visit any protected section
 * (operator manifest, passenger overview, etc.). Individual layouts impose
 * their own finer-grained checks for sections that restrict ADMIN entry.
 *
 * Examples:
 *   isAllowedPath("ADMIN",     "/admin/users")    → true
 *   isAllowedPath("ADMIN",     "/operator/trips") → true  (admin has full access)
 *   isAllowedPath("OPERATOR",  "/operator/trips") → true
 *   isAllowedPath("OPERATOR",  "/admin/users")    → false
 *   isAllowedPath("PASSENGER", "/operator")       → false
 */
export function isAllowedPath(role: UserRole, pathname: string): boolean {
  // Admins have company-wide access — never blocked by role-path checks.
  if (role === "ADMIN") return true;

  const dashboard = ROLE_DASHBOARD[role];
  // Root dashboard exact match OR any sub-path.
  return pathname === dashboard || pathname.startsWith(dashboard + "/");
}
