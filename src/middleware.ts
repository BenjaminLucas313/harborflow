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

  // Already on the login page → send to own dashboard.
  if (pathname === LOGIN_PATH) {
    const dest = req.nextUrl.clone();
    dest.pathname = dashboard;
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  // Public landing page → let through (passengers may browse while logged in).
  if (pathname === "/") return NextResponse.next();

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
