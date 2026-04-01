// Shared domain types derived from Prisma. Not a dumping ground — keep this minimal.
// For Auth.js session/JWT type extensions, see types/next-auth.d.ts.
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

// The authenticated user shape as it appears in session.user throughout the app.
// Derived from the Auth.js Session type so it stays in sync with next-auth.d.ts.
export type SessionUser = NonNullable<Session["user"]>;

export type { UserRole };
