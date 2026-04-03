// Trip manifest — server component for operator/admin view.
// Shows all passengers booked on a specific trip with names, status, and
// waitlist position where applicable.

import { getTranslations } from "next-intl/server";
import type { ReservationRow } from "@/modules/reservations/repository";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ManifestEntry = ReservationRow & {
  passengerName: string;
  /** Only present for WAITLISTED reservations. */
  waitlistPosition?: number;
};

type Props = { entries: ManifestEntry[] };

export async function Manifest({ entries }: Props) {
  const t = await getTranslations("reservations");

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
        {t("manifest.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Mobile: card stack */}
      <ul className="divide-y divide-border sm:hidden" role="list">
        {entries.map((e) => {
          const badgeClass =
            STATUS_CLASSES[e.status] ?? "bg-muted text-muted-foreground";

          return (
            <li key={e.id} className="px-4 py-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{e.passengerName}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                >
                  {t(`status.${e.status}`)}
                </span>
              </div>
              {e.status === "WAITLISTED" && e.waitlistPosition != null && (
                <p className="text-xs text-muted-foreground">
                  {t("manifest.position")} {e.waitlistPosition}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("manifest.passenger")}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("manifest.status")}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("manifest.position")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => {
              const badgeClass =
                STATUS_CLASSES[e.status] ?? "bg-muted text-muted-foreground";

              return (
                <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium">{e.passengerName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                    >
                      {t(`status.${e.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {e.status === "WAITLISTED" && e.waitlistPosition != null
                      ? e.waitlistPosition
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
