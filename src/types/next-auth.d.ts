// Module augmentation for Auth.js v5.
// Extends the default Session, User, and JWT types with HarborFlow's domain fields.
// This file is automatically picked up by TypeScript — no import needed.

import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      companyId: string;
      branchId: string | null;
      firstName: string;
      lastName: string;
      role: UserRole;
      // V2 additions
      /** For UABL users: the department this user can review slots for. */
      departmentId: string | null;
      /** For EMPRESA users: the employer entity they book on behalf of. */
      employerId: string | null;
      /** For UABL users: if true, can manage departments and work types. */
      isUablAdmin: boolean;
    } & DefaultSession["user"];
  }

  // Returned by authorize() and passed to the jwt callback as `user`.
  interface User {
    companyId: string;
    branchId: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    // V2 additions
    departmentId: string | null;
    employerId: string | null;
    isUablAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  // Claims stored inside the JWT and projected into session via the session callback.
  interface JWT {
    companyId: string;
    branchId: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    // V2 additions
    departmentId: string | null;
    employerId: string | null;
    isUablAdmin: boolean;
  }
}
