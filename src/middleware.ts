// HarborFlow — Edge middleware for authentication and role-based routing.
//
// Execution order for every matched request:
//   1. Auth.js reads the JWT from the cookie (Edge-compatible, no DB call).
//   2. Unauthenticated request to a protected route  → redirect to /login.
//   3. Authenticated request to /login               → redirect to role dashboard.
//   4. Authenticated request to the wrong role area  → redirect to own dashboard.
//   5. All other requests pass through unchanged.
//
// next-intl note: this project uses next-intl WITHOUT locale-prefixed URLs,
// so there is no createMiddleware() to compose — Auth.js middleware runs alone.

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import {
  PUBLIC_ROUTES,
  SHARED_AUTH_ROUTES,
  LOGIN_PATH,
  dashboardForRole,
  isAllowedPath,
} from "@/lib/routes";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!session) {
    if (isPublic) return NextResponse.next();

    // Preserve the intended destination so the login page can redirect back.
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  const { role } = session.user;
  const dashboard = dashboardForRole(role);

  // Legacy V1 roles (PASSENGER, OPERATOR, ADMIN) have no V2 dashboard — their
  // ROLE_DASHBOARD entry is "/", which would cause every redirect to loop back
  // to the landing page. Treat them as needing re-authentication: let public
  // routes through, push everything else to /login.
  if (dashboard === "/") {
    if (isPublic) return NextResponse.next();
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    return NextResponse.redirect(loginUrl);
  }

  // Already on login or register → send to own dashboard (already signed in).
  if (pathname === LOGIN_PATH || pathname === "/register") {
    const dest = req.nextUrl.clone();
    dest.pathname = dashboard;
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  // Public landing page — unauthenticated allowed through; authenticated users
  // are sent directly to their dashboard so they never get stuck on "/".
  if (pathname === "/") {
    const dest = req.nextUrl.clone();
    dest.pathname = dashboard;
    dest.search   = "";
    return NextResponse.redirect(dest);
  }

  // mustChangePassword guard — redirect to /perfil to force password change.
  // Only applies to page routes (API routes are excluded by the matcher).
  // The /perfil route itself is allowed through so the user can actually change
  // their password. Once they do, the client calls useSession().update() to
  // clear the flag in the JWT without requiring a re-login.
  if (
    session.user.mustChangePassword &&
    !pathname.startsWith("/perfil")
  ) {
    const dest = req.nextUrl.clone();
    dest.pathname = "/perfil";
    dest.search   = "?tab=password&forced=true";
    return NextResponse.redirect(dest);
  }

  // Shared auth routes (e.g. /perfil) are accessible to any authenticated role.
  const isShared = SHARED_AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  if (isShared) return NextResponse.next();

  // Onboarding guard: EMPRESA without employerId must complete setup first.
  // Excluded paths: the onboarding page itself (to avoid redirect loops).
  if (
    role === "EMPRESA" &&
    !session.user.employerId &&
    !pathname.startsWith("/empresa/onboarding")
  ) {
    const dest = req.nextUrl.clone();
    dest.pathname = "/empresa/onboarding";
    dest.search   = "";
    return NextResponse.redirect(dest);
  }

  // Protected route that doesn't belong to this role → redirect to own dashboard.
  if (!isAllowedPath(role, pathname)) {
    const dest = req.nextUrl.clone();
    dest.pathname = dashboard;
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match every path except:
     *   - Next.js internals  (_next/static, _next/image, favicon.ico, etc.)
     *   - Auth.js API routes (/api/auth/*)
     *   - Common static extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
