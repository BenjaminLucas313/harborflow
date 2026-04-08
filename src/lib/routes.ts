// Centralised route constants and role-to-dashboard mapping.
// Imported by both middleware (Edge) and server layouts — keep this file free
// of Node.js-only imports so it remains Edge-compatible.

import type { UserRole } from "@prisma/client";

/** Routes that are always reachable without authentication. */
export const PUBLIC_ROUTES: string[] = ["/", "/login"];

/** The fallback path when an unauthenticated user hits a protected route. */
export const LOGIN_PATH = "/login";

/** Root path for each role's dashboard. */
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  EMPLOYEE:    "/employee",
  COMPANY_REP: "/company",
  UABL_STAFF:  "/uabl",
  PROVIDER:    "/provider",
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
 * PROVIDER has fleet-wide oversight and can access any section.
 *
 * Examples:
 *   isAllowedPath("PROVIDER",    "/uabl/metrics")    → true  (provider has full access)
 *   isAllowedPath("UABL_STAFF",  "/uabl/trips")      → true
 *   isAllowedPath("UABL_STAFF",  "/company/trips")   → false
 *   isAllowedPath("COMPANY_REP", "/company/trips")   → true
 *   isAllowedPath("EMPLOYEE",    "/company")         → false
 */
export function isAllowedPath(role: UserRole, pathname: string): boolean {
  // Provider has system-wide oversight access.
  if (role === "PROVIDER") return true;

  const dashboard = ROLE_DASHBOARD[role];
  // Root dashboard exact match OR any sub-path.
  return pathname === dashboard || pathname.startsWith(dashboard + "/");
}
