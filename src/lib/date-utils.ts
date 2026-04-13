// =============================================================================
// date-utils.ts — Date helpers scoped to Argentina timezone (UTC-3)
// =============================================================================
//
// Argentina does NOT observe DST, so the offset is always fixed at UTC-3.
// All "current time" comparisons use the Argentina wall-clock representation
// to avoid off-by-one-hour errors during DST transitions in other regions.
//
// =============================================================================

const ARG_TZ = "America/Argentina/Buenos_Aires"; // UTC-3, no DST

// =============================================================================
// Internal helper
// =============================================================================

/** Returns the current wall-clock Date in Argentina time (no DST). */
function nowInArgentina(): Date {
  // toLocaleString with timeZone produces a local-time string; re-parse it as
  // if it were UTC to get a Date whose .getTime() represents Argentina "now".
  const str = new Date().toLocaleString("sv-SE", { timeZone: ARG_TZ });
  return new Date(str);
}

/** Converts any Date to its Argentina wall-clock representation. */
function toArgentinaDate(date: Date): Date {
  const str = date.toLocaleString("sv-SE", { timeZone: ARG_TZ });
  return new Date(str);
}

// =============================================================================
// isDatePast
// =============================================================================

/**
 * Returns true if `date` is strictly before the current moment in Argentina time.
 *
 * Comparison is at millisecond precision — a date equal to "now" is NOT past.
 */
export function isDatePast(date: Date): boolean {
  return date.getTime() < Date.now();
}

// =============================================================================
// isTripAvailable
// =============================================================================

/**
 * Returns true if a trip is still open for reservation.
 *
 * A trip is considered unavailable when its departure is:
 *   - already in the past, OR
 *   - less than 1 hour from now
 *
 * @param departureTime  The UTC departure timestamp stored in the database.
 */
export function isTripAvailable(departureTime: Date): boolean {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return departureTime.getTime() - Date.now() >= ONE_HOUR_MS;
}

// =============================================================================
// formatArgDate
// =============================================================================

/**
 * Formats a date in a Spanish-readable representation using Argentina timezone.
 *
 * Example output: "lunes, 14 de abril de 2026, 10:30"
 */
export function formatArgDate(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone:    ARG_TZ,
    weekday:     "long",
    day:         "numeric",
    month:       "long",
    year:        "numeric",
    hour:        "2-digit",
    minute:      "2-digit",
    hour12:      false,
  });
}

/**
 * Returns the Argentina-local date string (YYYY-MM-DD) for a given UTC Date.
 * Useful for day-boundary checks and display.
 */
export function toArgDateString(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
}

/**
 * Returns true if `date` falls on a past calendar day in Argentina time
 * (i.e., the Argentina date is before today's Argentina date).
 * Use this for date-only comparisons (e.g., trip departure date input).
 */
export function isArgDatePast(date: Date): boolean {
  const today = toArgDateString(new Date());
  const target = toArgDateString(date);
  return target < today;
}
