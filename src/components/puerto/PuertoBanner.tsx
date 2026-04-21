"use client";

// =============================================================================
// PuertoBanner — Persistent app-wide port status banner
// =============================================================================
//
// Renders a thin colored bar below the nav when the port has a non-OPEN status.
// Dismissable per browser session via sessionStorage.
//
// BEHAVIOR
// --------
//   OPERATIVO  (OPEN)          → Not rendered.
//   ADVERTENCIA (PARTIALLY_OPEN) → Amber bar. Dismissable.
//   CERRADO     (any CLOSED_*)  → Red bar. Dismissable.
//
//   Dismiss key: `pb-dismissed-{statusId}`
//   Dismissed state persists for the browser session only (sessionStorage).
//
// MOTION
// ------
//   Entrance: fade-in + slide-in-from-top-1 (200ms, motion-safe only).
//   Exit: immediate (no exit animation needed for a persistent banner).
//
// USAGE
// -----
//   <PuertoBanner
//     status="CLOSED_WEATHER"
//     message="Vientos de 80 km/h."
//     statusId="cm123"
//     branchName="Puerto Central"
//   />
//
// =============================================================================

import { useState, useEffect } from "react";
import { AlertTriangle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDisplayStatus,
  DISPLAY_STYLE,
  STATUS_TITLE,
  STATUS_SUBTITLE,
} from "./port-status-config";
import type { PortStatusValue } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  status:      PortStatusValue;
  message?:    string | null;
  /** PortStatus record id — used as the sessionStorage dismiss key. */
  statusId:    string;
  branchName?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageKey(statusId: string) {
  return `pb-dismissed-${statusId}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PuertoBanner({ status, message, statusId, branchName }: Props) {
  const display  = getDisplayStatus(status);
  const style    = DISPLAY_STYLE[display];
  const title    = STATUS_TITLE[status] ?? "Estado del puerto";
  const subtitle = STATUS_SUBTITLE[status];

  // Avoid SSR/hydration mismatch: read sessionStorage only on the client.
  const [mounted,   setMounted]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(sessionStorage.getItem(storageKey(statusId)) === "1");
  }, [statusId]);

  // Don't render anything: OPERATIVO status, pre-hydration, or already dismissed.
  if (!mounted || dismissed || display === "OPERATIVO") return null;

  const Icon = display === "CERRADO" ? XCircle : AlertTriangle;

  function handleDismiss() {
    sessionStorage.setItem(storageKey(statusId), "1");
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "w-full border-b px-4 py-2.5 banner-slide-in",
        style.bg,
        style.border,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        {/* Status icon with pulse ring */}
        <div className="relative shrink-0 flex items-center justify-center">
          <span
            aria-hidden="true"
            className={cn(
              "absolute inline-block size-4 rounded-full",
              display === "CERRADO"     && "bg-red-400",
              display === "ADVERTENCIA" && "bg-amber-400",
            )}
            style={{ animation: "pulse-ring 2s ease-out infinite" }}
          />
          <Icon
            className={cn("size-4 relative z-10", style.text)}
            aria-hidden="true"
          />
        </div>

        {/* Message content */}
        <div className="min-w-0 flex-1 text-sm">
          <span className={cn("font-semibold", style.text)}>
            {title}
          </span>

          {(branchName || subtitle) && (
            <span className={cn("ml-1.5", style.textMuted)}>
              {branchName
                ? `${branchName}${subtitle ? " · " : ""}`
                : ""}
              {subtitle}
            </span>
          )}

          {message && (
            <span className={cn("ml-1.5", style.textMuted)}>
              — {message}
            </span>
          )}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "shrink-0 rounded p-0.5 transition-colors",
            "hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            style.text,
          )}
          aria-label="Cerrar aviso del puerto"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
