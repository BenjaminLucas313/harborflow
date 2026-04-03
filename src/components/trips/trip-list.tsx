// Trip list table — server component.
// Renders a branch's trips with status badges and key operational fields.

import { getTranslations } from "next-intl/server";
import type { TripRow } from "@/modules/trips/repository";
import { TripStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<TripStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  BOARDING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  DELAYED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  DEPARTED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
};

function formatDateTime(date: Date): string {
  return date.toLocaleString("es", {
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

type Props = { trips: TripRow[] };

export async function TripList({ trips }: Props) {
  const t = await getTranslations("trips");

  if (trips.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Mobile: card stack */}
      <ul className="divide-y divide-border sm:hidden" role="list">
        {trips.map((trip) => (
          <li key={trip.id} className="px-4 py-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{formatDateTime(trip.departureTime)}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[trip.status]}`}
              >
                {t(`status.${trip.status}`)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground">{trip.boat.name}</span>
                {" — "}
                {trip.capacity} pax
              </p>
              <p>
                {trip.driver
                  ? `${trip.driver.firstName} ${trip.driver.lastName}`
                  : t("list.noDriver")}
              </p>
              {trip.estimatedArrivalTime && (
                <p className="text-xs">
                  {t("list.arrival")}: {formatDateTime(trip.estimatedArrivalTime)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              {(["departure", "arrival", "boat", "driver", "capacity", "status"] as const).map(
                (col) => (
                  <th
                    key={col}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {t(`list.${col}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trips.map((trip) => (
              <tr key={trip.id} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {formatDateTime(trip.departureTime)}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {trip.estimatedArrivalTime
                    ? formatDateTime(trip.estimatedArrivalTime)
                    : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{trip.boat.name}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {trip.driver
                    ? `${trip.driver.firstName} ${trip.driver.lastName}`
                    : <span className="italic">{t("list.noDriver")}</span>}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{trip.capacity}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[trip.status]}`}
                  >
                    {t(`status.${trip.status}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
