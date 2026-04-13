// =============================================================================
// Port Status UI Configuration
// =============================================================================
//
// Maps PortStatusValue enum → display category and visual style.
// Shared between EstadoModal and PuertoBanner to ensure consistency.
//
// Display categories:
//   OPERATIVO   → green    (OPEN)
//   ADVERTENCIA → orange   (PARTIALLY_OPEN)
//   CERRADO     → red      (any CLOSED_*)
//
// =============================================================================

// Import only the type — safe in both server and client components.
import type { PortStatusValue } from "@prisma/client";

// ---------------------------------------------------------------------------
// Display category
// ---------------------------------------------------------------------------

export type DisplayStatus = "OPERATIVO" | "ADVERTENCIA" | "CERRADO";

export function getDisplayStatus(status: PortStatusValue): DisplayStatus {
  if (status === "OPEN")          return "OPERATIVO";
  if (status === "PARTIALLY_OPEN") return "ADVERTENCIA";
  return "CERRADO";
}

// ---------------------------------------------------------------------------
// Human-readable title per status value
// ---------------------------------------------------------------------------

export const STATUS_TITLE: Record<string, string> = {
  OPEN:               "Puerto operativo",
  PARTIALLY_OPEN:     "Puerto con restricciones",
  CLOSED_WEATHER:     "Puerto cerrado",
  CLOSED_MAINTENANCE: "Puerto cerrado",
  CLOSED_SECURITY:    "Puerto cerrado",
  CLOSED_OTHER:       "Puerto cerrado",
};

export const STATUS_SUBTITLE: Record<string, string> = {
  OPEN:               "",
  PARTIALLY_OPEN:     "Operaciones con restricciones",
  CLOSED_WEATHER:     "Condiciones climáticas adversas",
  CLOSED_MAINTENANCE: "Por mantenimiento programado",
  CLOSED_SECURITY:    "Por razones de seguridad",
  CLOSED_OTHER:       "Temporalmente fuera de servicio",
};

// ---------------------------------------------------------------------------
// Visual style per display category
// ---------------------------------------------------------------------------

export type StatusStyle = {
  /** Banner / modal background */
  bg:         string;
  /** Border color */
  border:     string;
  /** Primary text color */
  text:       string;
  /** Muted / secondary text */
  textMuted:  string;
  /** Icon fill for the indicator dot */
  dot:        string;
  /** Lucide icon name to use */
  iconName:   "check-circle-2" | "alert-triangle" | "x-circle";
};

export const DISPLAY_STYLE: Record<DisplayStatus, StatusStyle> = {
  OPERATIVO: {
    bg:        "bg-emerald-50",
    border:    "border-emerald-200",
    text:      "text-emerald-900",
    textMuted: "text-emerald-700",
    dot:       "bg-emerald-500",
    iconName:  "check-circle-2",
  },
  ADVERTENCIA: {
    bg:        "bg-amber-50",
    border:    "border-amber-300",
    text:      "text-amber-900",
    textMuted: "text-amber-700",
    dot:       "bg-amber-500",
    iconName:  "alert-triangle",
  },
  CERRADO: {
    bg:        "bg-red-50",
    border:    "border-red-300",
    text:      "text-red-900",
    textMuted: "text-red-700",
    dot:       "bg-red-500",
    iconName:  "x-circle",
  },
};

// ---------------------------------------------------------------------------
// Auto-dismiss policy (seconds; 0 = no auto-dismiss)
// ---------------------------------------------------------------------------

export const AUTO_DISMISS_SECONDS: Record<DisplayStatus, number> = {
  OPERATIVO:   0,
  ADVERTENCIA: 8,
  CERRADO:     0,
};
