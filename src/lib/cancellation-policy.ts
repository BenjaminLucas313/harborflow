// =============================================================================
// Cancellation Policy
// =============================================================================
//
// Defines who can cancel a booking and when.
//
// RULES
// -----
//   • Up to 2 hours before departure  → EMPRESA user can cancel their own booking.
//   • Within 2 hours of departure     → Self-cancel is blocked; only an admin can cancel.
//   • After departure (trip past)     → No cancellation allowed via this API;
//                                        handled by the liquidation workflow.
//
// The same 2-hour window applies to both solicitudes (TripRequests) and
// reservas (GroupBookings).
//
// =============================================================================

/** 2-hour self-cancel window in milliseconds. */
export const CANCELLATION_CUTOFF_MS = 2 * 60 * 60 * 1000;

export type CancellationCheck =
  | { allowed: true }
  | { allowed: false; reason: "TRIP_ALREADY_PAST" | "TOO_CLOSE_TO_DEPARTURE" };

/**
 * Checks whether an EMPRESA user is still within the self-cancel window.
 *
 * @param departureTime  UTC departure timestamp of the associated trip/request.
 * @returns `{ allowed: true }` if cancellation is permitted,
 *          or `{ allowed: false, reason }` with the specific blocking reason.
 */
export function checkSelfCancellation(departureTime: Date): CancellationCheck {
  const now = Date.now();
  const departure = departureTime.getTime();

  if (departure <= now) {
    return { allowed: false, reason: "TRIP_ALREADY_PAST" };
  }

  if (departure - now < CANCELLATION_CUTOFF_MS) {
    return { allowed: false, reason: "TOO_CLOSE_TO_DEPARTURE" };
  }

  return { allowed: true };
}

/**
 * Human-readable error messages for each blocking reason.
 * Use these in API error responses.
 */
export const CANCELLATION_MESSAGES: Record<
  "TRIP_ALREADY_PAST" | "TOO_CLOSE_TO_DEPARTURE",
  string
> = {
  TRIP_ALREADY_PAST:
    "No se puede cancelar: el viaje ya pasó.",
  TOO_CLOSE_TO_DEPARTURE:
    "Solo un administrador puede cancelar con menos de 2 horas de anticipación.",
};
