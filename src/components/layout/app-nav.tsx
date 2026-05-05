// Shared top navigation bar — server component rendered by each role layout.
// Brand (left) · Optional UABL assistant CTA · NavUserMenu (right)

import Link from "next/link";
import { Anchor } from "lucide-react";
import { NotificacionesBell } from "@/components/ui/NotificacionesBell";
import { NavUserMenu } from "@/components/layout/nav-user-menu";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  firstName:       string;
  lastName:        string;
  role:            string;
  isUablAdmin?:    boolean;
  departmentName?: string | null;
  employerName?:   string | null;
  /** Company display name shown as user subtitle. */
  companyName?: string;
  /** The home link for this role (clicking the brand navigates here). */
  homeHref: string;
  /**
   * When provided, renders an AI Assistant CTA button in the nav bar.
   * Only passed by the UABL layout — other roles don't see this.
   */
  assistantHref?: string;
  /** When provided, overrides the /perfil link in the user menu for role-specific profile pages. */
  perfilHref?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppNav({
  firstName,
  lastName,
  role,
  isUablAdmin,
  departmentName,
  employerName,
  homeHref,
  assistantHref,
  perfilHref,
}: Props) {
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

        {/* UABL Assistant CTA */}
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
            <span className="hidden sm:block tracking-[0.01em]" style={{ color: "#f0f6ff" }}>
              Assistant
            </span>
            <span className="sm:hidden" style={{ color: "#f0f6ff" }}>
              AI
            </span>
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: "#34d399" }}
              aria-hidden="true"
            />
          </Link>
        )}

        {/* Right side: notifications + user menu */}
        <div className="flex items-center gap-3 ml-auto">
          <NotificacionesBell />
          <NavUserMenu
            firstName={firstName}
            lastName={lastName}
            role={role}
            isUablAdmin={isUablAdmin}
            departmentName={departmentName}
            employerName={employerName}
            perfilHref={perfilHref}
          />
        </div>

      </div>
    </header>
  );
}
