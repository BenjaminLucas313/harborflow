// Shared top navigation bar — server component rendered by each role layout.
// Brand (left) · User name + company (right) · Role badge · Logout action.

import Link from "next/link";
import { Anchor } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificacionesBell } from "@/components/ui/NotificacionesBell";

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
  /**
   * When provided, renders an AI Assistant CTA button in the nav bar.
   * Only passed by the UABL layout — other roles don't see this.
   */
  assistantHref?: string;
};

export function AppNav({
  firstName,
  lastName,
  role,
  companyName,
  homeHref,
  assistantHref,
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

        {/* UABL Assistant CTA — only rendered when assistantHref is provided */}
        {assistantHref && (
          <Link
            href={assistantHref}
            className="assistant-cta-btn flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-sm font-semibold shadow-sm transition-opacity hover:opacity-85"
            style={{
              background:     "linear-gradient(135deg, #0d1b35 0%, #1e3a5f 100%)",
              border:         "1px solid rgba(96,165,250,0.25)",
              textDecoration: "none",
            }}
            aria-label="Abrir UABL Assistant"
          >
            <Anchor
              className="size-4 shrink-0"
              style={{ color: "#60a5fa" }}
              aria-hidden="true"
            />
            {/* "Assistant" on desktop, "AI" on mobile */}
            <span className="hidden sm:block tracking-[0.01em]" style={{ color: "#f0f6ff" }}>
              Assistant
            </span>
            <span className="sm:hidden" style={{ color: "#f0f6ff" }}>
              AI
            </span>
            {/* Live dot */}
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: "#34d399" }}
              aria-hidden="true"
            />
          </Link>
        )}

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

          <NotificacionesBell />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
