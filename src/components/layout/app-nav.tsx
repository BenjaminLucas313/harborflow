// Shared top navigation bar — server component rendered by each role layout.
// Brand (left) · User name + company (right) · Role badge · Logout action.

import Link from "next/link";
import { Anchor } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

// ---------------------------------------------------------------------------
// Role badge mapping
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<string, { label: string; classes: string }> = {
  // V2 roles
  USUARIO: {
    label: "Usuario",
    classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  EMPRESA: {
    label: "Empresa",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  UABL: {
    label: "UABL",
    classes: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  PROVEEDOR: {
    label: "Proveedor",
    classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  // V1 legacy (kept for backwards compat)
  PASSENGER: {
    label: "Passenger",
    classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  OPERATOR: {
    label: "Operator",
    classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  ADMIN: {
    label: "Admin",
    classes: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  firstName: string;
  lastName: string;
  role: string;
  /** Company display name shown below the user name. */
  companyName?: string;
  /** The home link for this role (clicking the brand navigates here). */
  homeHref: string;
};

export function AppNav({
  firstName,
  lastName,
  role,
  companyName,
  homeHref,
}: Props) {
  const badge = ROLE_BADGE[role];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          href={homeHref}
          className="flex items-center gap-2 font-semibold text-primary hover:opacity-80 transition-opacity shrink-0"
        >
          <Anchor className="size-5" aria-hidden="true" />
          <span className="hidden sm:block tracking-tight">HarborFlow</span>
        </Link>

        {/* Right side: user info + role badge + logout */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Name + company — hidden on small screens */}
          <div className="hidden sm:block text-right min-w-0 max-w-[180px]">
            <p className="text-sm font-medium leading-none truncate">
              {firstName} {lastName}
            </p>
            {companyName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {companyName}
              </p>
            )}
          </div>

          {/* Role badge */}
          {badge && (
            <span
              className={`hidden sm:inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}
            >
              {badge.label}
            </span>
          )}

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
