// Auth.js v5 configuration.
//
// Strategy: credentials-only + JWT sessions.
//
// The Prisma adapter is intentionally NOT used because:
//   1. Our email is unique per-company, not globally — the adapter assumes global uniqueness.
//   2. JWT sessions require no Session table writes.
//   3. No OAuth or email verification in V1, so Account/VerificationToken tables are unnecessary.
//
// Requires AUTH_SECRET in .env (generate: openssl rand -base64 32).

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/modules/auth/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      // Field definitions used by the built-in sign-in page (not our custom UI).
      credentials: {
        email: {},
        password: {},
        companySlug: {},
      },

      async authorize(credentials) {
        // 1. Validate input shape.
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, companySlug } = parsed.data;

        // 2. Resolve tenant by slug.
        const company = await prisma.company.findUnique({
          where: { slug: companySlug },
          select: { id: true, isActive: true },
        });
        if (!company?.isActive) return null;

        // 3. Look up user within that tenant by compound unique key.
        const user = await prisma.user.findUnique({
          where: { companyId_email: { companyId: company.id, email } },
          select: {
            id: true,
            email: true,
            companyId: true,
            branchId: true,
            firstName: true,
            lastName: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });
        if (!user?.isActive) return null;

        // 4. Verify password.
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // 5. Return the user object that Auth.js will embed in the JWT.
        //    passwordHash is intentionally excluded.
        return {
          id: user.id,
          email: user.email,
          companyId: user.companyId,
          branchId: user.branchId,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Stamp custom claims onto the token at login time.
    // `user` is only present on the first call (right after authorize returns).
    jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId;
        token.branchId = user.branchId ?? null;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
      }
      return token;
    },

    // Project token claims into the session object available to the app.
    // token.sub is the user.id set automatically by Auth.js.
    // Explicit casts are required here: the session callback's `token` parameter
    // is typed as the base JWT (unknown claims) regardless of module augmentation.
    // The values are safe — they were set in the jwt callback above.
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.companyId = token.companyId as string;
      session.user.branchId = token.branchId as string | null;
      session.user.firstName = token.firstName as string;
      session.user.lastName = token.lastName as string;
      session.user.role = token.role as UserRole;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
