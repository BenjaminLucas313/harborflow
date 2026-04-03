// Passenger's own reservation list — server component.
// Shows each active reservation with trip details, status, and a cancel action.

import { getTranslations } from "next-intl/server";
import type { ReservationRow } from "@/modules/reservations/repository";
import { CancelReservationButton } from "./cancel-reservation-button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<string, string> = {
  CONFIRMED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  WAITLISTED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CHECKED_IN:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

function formatDate(date: Date): string {
  return date.toLocaleString("es", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** id + position for a waitlist entry, keyed by tripId. */
export type WaitlistInfo = { id: string; position: number };

type Props = {
  reservations: ReservationRow[];
  /** Maps tripId → waitlist entry id + position for WAITLISTED reservations. */
  waitlistEntries?: Map<string, WaitlistInfo>;
};

export async function ReservationList({ reservations, waitlistEntries }: Props) {
  const t = await getTranslations("reservations");

  if (reservations.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
        {t("myReservations.empty")}
      </p>
    );
  }

  return (
    <ul className="space-y-3" role="list">
      {reservations.map((r) => {
        const waitlistInfo = waitlistEntries?.get(r.tripId);
        const badgeClass =
          STATUS_CLASSES[r.status] ?? "bg-muted text-muted-foreground";

        return (
          <li
            key={r.id}
            className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm space-y-3"
          >
            {/* Trip header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <p className="font-medium text-sm">
                  {formatDate(r.trip.departureTime)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.trip.boat.name}
                  {r.trip.driver && (
                    <>
                      {" · "}
                      {r.trip.driver.firstName} {r.trip.driver.lastName}
                    </>
                  )}
                </p>
              </div>

              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {t(`status.${r.status}`)}
              </span>
            </div>

            {/* Waitlist position */}
            {r.status === "WAITLISTED" && waitlistInfo != null && (
              <p className="text-xs text-muted-foreground">
                {t("myReservations.waitlistPosition", {
                  position: waitlistInfo.position,
                })}
              </p>
            )}

            {/* Cancel action — CONFIRMED and WAITLISTED only */}
            {r.status === "CONFIRMED" && (
              <CancelReservationButton
                type="reservation"
                reservationId={r.id}
              />
            )}
            {r.status === "WAITLISTED" && waitlistInfo != null && (
              <CancelReservationButton
                type="waitlist"
                entryId={waitlistInfo.id}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
