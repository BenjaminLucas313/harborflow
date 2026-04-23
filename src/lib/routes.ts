// Centralised route constants and role-to-dashboard mapping.
// Imported by both middleware (Edge) and server layouts — keep this file free
// of Node.js-only imports so it remains Edge-compatible.

import type { UserRole } from "@prisma/client";

/** Routes that are always reachable without authentication. */
export const PUBLIC_ROUTES: string[] = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/** Routes reachable by any authenticated user, regardless of role. */
export const SHARED_AUTH_ROUTES: string[] = ["/perfil"];

/** The fallback path when an unauthenticated user hits a protected route. */
export const LOGIN_PATH = "/login";

/**
 * Root path for each role's dashboard.
 *
 * V2 roles: USUARIO, EMPRESA, UABL, PROVEEDOR
 * V1 legacy roles (PASSENGER, OPERATOR, ADMIN) map to "/" as a safe fallback
 * until their accounts are migrated. They will be redirected to login from there.
 */
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  // V2 roles
  USUARIO:   "/usuario",
  EMPRESA:   "/empresa",
  UABL:      "/uabl",
  PROVEEDOR: "/proveedor",
  CONDUCTOR: "/conductor",
  // V1 legacy — safe fallback, these accounts should be remapped
  PASSENGER: "/",
  OPERATOR:  "/",
  ADMIN:     "/",
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
 * UABL users have broader access: they can access their own /uabl/* section
 * including the /uabl/admin/* sub-section (isUablAdmin is checked at layout level).
 *
 * Examples:
 *   isAllowedPath("UABL",      "/uabl/metricas")   → true
 *   isAllowedPath("UABL",      "/uabl/admin")       → true  (layout checks isUablAdmin)
 *   isAllowedPath("EMPRESA",   "/empresa/reservas") → true
 *   isAllowedPath("EMPRESA",   "/uabl")             → false
 *   isAllowedPath("USUARIO",   "/empresa")          → false
 */
export function isAllowedPath(role: UserRole, pathname: string): boolean {
  const dashboard = ROLE_DASHBOARD[role];

  // Legacy roles without a real dashboard — they have no allowed paths.
  if (dashboard === "/") return false;

  // Root dashboard exact match OR any sub-path.
  return pathname === dashboard || pathname.startsWith(dashboard + "/");
}
