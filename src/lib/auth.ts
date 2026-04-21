// Auth.js v5 configuration — Node.js server only.
//
// Strategy: credentials-only + JWT sessions.
//
// The Prisma adapter is intentionally NOT used because:
//   1. Our email is unique per-company, not globally — the adapter assumes global uniqueness.
//   2. JWT sessions require no Session table writes.
//   3. No OAuth or email verification in V1/V2, so Account/VerificationToken tables are unnecessary.
//
// Requires AUTH_SECRET in .env (generate: openssl rand -base64 32).
//
// ⚠️  Do NOT import this file from middleware.ts or any Edge runtime path.
//     Edge-safe auth config lives in auth.config.ts.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/modules/auth/schema";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
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
            // V2 additions
            departmentId: true,
            employerId: true,
            isUablAdmin: true,
          },
        });
        if (!user?.isActive) return null;

        // 4. Verify password.
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (process.env.NODE_ENV === "development") {
          console.log(`[authorize] user=${email} companySlug=${companySlug} role=${user.role} id=${user.id}`);
        }

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
          departmentId: user.departmentId,
          employerId: user.employerId,
          isUablAdmin: user.isUablAdmin,
        };
      },
    }),
  ],
});
