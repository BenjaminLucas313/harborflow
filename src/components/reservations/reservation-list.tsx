// Passenger's own reservation list — server component.
// Each card shows trip details, status, waitlist position, and a cancel action.

import { getTranslations } from "next-intl/server";
import type { ReservationRow } from "@/modules/reservations/repository";
import { CancelReservationButton } from "./cancel-reservation-button";

// ---------------------------------------------------------------------------
// Visual mappings
// ---------------------------------------------------------------------------

// Left-edge accent bar colour per status.
const STATUS_ACCENT: Record<string, string> = {
  CONFIRMED: "bg-emerald-500",
  WAITLISTED: "bg-amber-400",
  CHECKED_IN: "bg-blue-500",
};

// Badge background + text per status.
const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  WAITLISTED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CHECKED_IN:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Waitlist entry id + queue position, keyed by tripId in the parent. */
export type WaitlistInfo = { id: string; position: number };

type Props = {
  reservations: ReservationRow[];
  /** Maps tripId → waitlist entry id + position for WAITLISTED reservations. */
  waitlistEntries?: Map<string, WaitlistInfo>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    <ul className="space-y-4" role="list">
      {reservations.map((r) => {
        const waitlistInfo = waitlistEntries?.get(r.tripId);
        const badgeClass =
          STATUS_BADGE[r.status] ?? "bg-muted text-muted-foreground";
        const accentClass = STATUS_ACCENT[r.status] ?? "bg-muted";

        return (
          <li
            key={r.id}
            className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
          >
            <div className="flex">
              {/* Left status accent bar */}
              <div
                className={`w-1 shrink-0 ${accentClass}`}
                aria-hidden="true"
              />

              <div className="flex-1 px-5 py-4 space-y-3 min-w-0">
                {/* Header: date + status badge */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground capitalize">
                      {formatDate(r.trip.departureTime)}
                    </p>
                    <p className="text-xl font-bold tabular-nums leading-none">
                      {formatTime(r.trip.departureTime)}
                      {r.trip.estimatedArrivalTime && (
                        <span className="text-base font-normal text-muted-foreground">
                          {" "}
                          <span className="text-sm">→</span>{" "}
                          {formatTime(r.trip.estimatedArrivalTime)}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground pt-0.5">
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
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${badgeClass}`}
                  >
                    {t(`status.${r.status}`)}
                  </span>
                </div>

                {/* Waitlist position */}
                {r.status === "WAITLISTED" && waitlistInfo != null && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {t("myReservations.waitlistPosition", {
                      position: waitlistInfo.position,
                    })}
                  </p>
                )}

                {/* Cancel actions — CONFIRMED and WAITLISTED only */}
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
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
