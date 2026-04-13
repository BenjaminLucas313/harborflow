"use client";

// =============================================================================
// EstadoModal — Port status alert modal
// =============================================================================
//
// Shows a prominent dialog when the port has a non-OPEN status.
// Uses @base-ui/react/dialog primitives (the project's UI primitive library).
//
// BEHAVIOR
// --------
//   ADVERTENCIA  (PARTIALLY_OPEN) → Auto-dismisses after 8 seconds.
//                                    Progress bar shows remaining time.
//   CERRADO      (any CLOSED_*)   → Never auto-dismisses. Requires
//                                    explicit user action.
//   OPERATIVO    (OPEN)           → Should not be shown; renders null.
//
// MOTION
// ------
//   Open:  fade-in + translate-y-2 → translate-y-0  (200ms ease-out)
//   Close: fade-out (150ms)
//   Per skill: ≤ 300ms, opacity + slight translate, respects reduced-motion.
//
// USAGE
// -----
//   <EstadoModal
//     open={showModal}
//     onClose={() => setShowModal(false)}
//     status="CLOSED_WEATHER"
//     message="Vientos de 80 km/h. Suspensión hasta las 18:00."
//     branchName="Puerto Central"
//   />
//
// =============================================================================

import { useEffect, useRef, useCallback } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDisplayStatus,
  DISPLAY_STYLE,
  STATUS_TITLE,
  STATUS_SUBTITLE,
  AUTO_DISMISS_SECONDS,
} from "./port-status-config";
import type { PortStatusValue } from "@prisma/client";

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_MAP = {
  "check-circle-2":  CheckCircle2,
  "alert-triangle":  AlertTriangle,
  "x-circle":        XCircle,
};

// ---------------------------------------------------------------------------
// Auto-dismiss progress bar
// ---------------------------------------------------------------------------

type ProgressProps = {
  seconds: number;
  onComplete: () => void;
};

function AutoDismissProgress({ seconds, onComplete }: ProgressProps) {
  const barRef    = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    // Trigger CSS transition from 100% → 0% over `seconds` seconds.
    // Use requestAnimationFrame to ensure the initial 100% paint completes first.
    bar.style.transition = "none";
    bar.style.width = "100%";

    const raf = requestAnimationFrame(() => {
      bar.style.transition = `width ${seconds}s linear`;
      bar.style.width = "0%";
    });

    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, seconds * 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [seconds]);

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-amber-200" role="progressbar" aria-label={`Cerrando en ${seconds} segundos`}>
      <div ref={barRef} className="h-full rounded-full bg-amber-500" style={{ width: "100%" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  open:        boolean;
  onClose:     () => void;
  status:      PortStatusValue;
  message?:    string | null;
  branchName?: string;
};

export function EstadoModal({ open, onClose, status, message, branchName }: Props) {
  const display  = getDisplayStatus(status);
  const style    = DISPLAY_STYLE[display];
  const title    = STATUS_TITLE[status] ?? "Estado del puerto";
  const subtitle = STATUS_SUBTITLE[status];
  const autoDismissS = AUTO_DISMISS_SECONDS[display];
  const Icon     = ICON_MAP[style.iconName];

  const handleClose = useCallback(() => onClose(), [onClose]);

  // OPERATIVO state should never show the modal.
  if (display === "OPERATIVO") return null;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
            "data-[ending-style]:motion-safe:animate-out data-[ending-style]:motion-safe:fade-out data-[ending-style]:motion-safe:duration-150",
          )}
        />

        {/* Popup */}
        <Dialog.Popup
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
          )}
        >
          <div
            className={cn(
              "w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4",
              style.bg,
              style.border,
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-safe:ease-out",
              "data-[ending-style]:motion-safe:animate-out data-[ending-style]:motion-safe:fade-out data-[ending-style]:motion-safe:duration-150",
            )}
            role="alertdialog"
            aria-labelledby="estado-modal-title"
            aria-describedby="estado-modal-desc"
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              {/* Status icon */}
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full",
                  display === "CERRADO"     && "bg-red-100",
                  display === "ADVERTENCIA" && "bg-amber-100",
                )}
              >
                <Icon
                  className={cn(
                    "size-6",
                    display === "CERRADO"     && "text-red-600",
                    display === "ADVERTENCIA" && "text-amber-600",
                  )}
                  aria-hidden="true"
                />
              </div>

              {/* Title + branch */}
              <div className="flex-1 min-w-0 pt-1">
                <Dialog.Title
                  id="estado-modal-title"
                  className={cn("text-xl font-bold leading-tight", style.text)}
                >
                  {title}
                </Dialog.Title>
                {(subtitle || branchName) && (
                  <p className={cn("mt-0.5 text-sm font-medium", style.textMuted)}>
                    {branchName ? `${branchName}${subtitle ? " · " : ""}` : ""}
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Close button (always shown; required for CERRADO) */}
              <Dialog.Close
                className={cn(
                  "shrink-0 rounded-lg p-1 transition-colors",
                  "hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                  style.text,
                )}
                aria-label="Cerrar"
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Message */}
            {message && (
              <Dialog.Description
                id="estado-modal-desc"
                className={cn("text-sm leading-relaxed rounded-xl px-4 py-3 border", style.textMuted, style.border,
                  display === "CERRADO"     && "bg-red-100/60",
                  display === "ADVERTENCIA" && "bg-amber-100/60",
                )}
              >
                {message}
              </Dialog.Description>
            )}

            {/* Auto-dismiss progress bar for ADVERTENCIA */}
            {autoDismissS > 0 && (
              <div className="space-y-1.5">
                <AutoDismissProgress seconds={autoDismissS} onComplete={handleClose} />
                <p className={cn("text-xs", style.textMuted)}>
                  Este aviso se cerrará automáticamente en {autoDismissS} segundos.
                </p>
              </div>
            )}

            {/* Explicit close CTA for CERRADO */}
            {autoDismissS === 0 && (
              <Dialog.Close
                className={cn(
                  "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  "border",
                  display === "CERRADO" && "border-red-300 bg-red-100 text-red-800 hover:bg-red-200",
                )}
              >
                Entendido
              </Dialog.Close>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
