// Edge-safe Auth.js v5 configuration slice.
//
// Contains ONLY what the Edge runtime needs: JWT/session callbacks, pages config,
// and session strategy. No Node.js-only imports (bcryptjs, Prisma, pg).
//
// Consumed by:
//   - src/middleware.ts  (Edge runtime — must stay Node-free)
//   - src/lib/auth.ts    (Node.js server — spreads this config and adds Credentials)

import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

export const authConfig = {
  // Providers are added in auth.ts (server-only). Edge middleware needs an
  // empty array here so the type is satisfied without importing Node.js deps.
  providers: [],

  session: { strategy: "jwt" },

  callbacks: {
    // Stamp custom claims onto the token at login time.
    // `user` is only present on the first call (right after authorize returns).
    jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId;
        token.branchId = user.branchId ?? null;
        // departmentId: present only for UABL_STAFF users.
        // Scopes their confirmation authority to their department's work types.
        token.departmentId = user.departmentId ?? null;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
      }
      return token;
    },

    // Project token claims into the session object available to the app.
    // token.sub is the user.id set automatically by Auth.js.
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.companyId = token.companyId as string;
      session.user.branchId = token.branchId as string | null;
      session.user.departmentId = token.departmentId as string | null;
      session.user.firstName = token.firstName as string;
      session.user.lastName = token.lastName as string;
      session.user.role = token.role as UserRole;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
