"use client";

// Reserve button shown on each trip row in the passenger trip list.
//
// States:
//   null status   → "Reserve" button, enabled
//   CONFIRMED     → green badge, no button
//   WAITLISTED    → amber badge, no button
//   Any other     → muted badge, no button
//
// On success the page is refreshed via router.refresh() so the server component
// re-fetches the updated reservation status.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { ReservationStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  Extract<ReservationStatus, "CONFIRMED" | "WAITLISTED" | "CHECKED_IN">,
  string
> = {
  CONFIRMED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  WAITLISTED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CHECKED_IN:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

function ReservationBadge({
  status,
  label,
}: {
  status: ReservationStatus;
  label: string;
}) {
  const classes =
    STATUS_BADGE[status as keyof typeof STATUS_BADGE] ??
    "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  tripId: string;
  /** null when the passenger has no active reservation for this trip. */
  reservationStatus: ReservationStatus | null;
};

export function ReserveButton({ tripId, reservationStatus }: Props) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already reserved — show status badge instead of a button.
  if (reservationStatus !== null) {
    return (
      <ReservationBadge
        status={reservationStatus}
        label={t(`status.${reservationStatus}`)}
      />
    );
  }

  const handleReserve = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (res.ok) {
        router.refresh();
        return;
      }

      const data = (await res.json()) as { code?: string };

      if (data.code === "RESERVATION_ALREADY_ACTIVE") {
        setError(t("errors.alreadyReserved"));
      } else if (
        data.code === "TRIP_NOT_BOOKABLE" ||
        data.code === "TRIP_NOT_FOUND"
      ) {
        setError(t("errors.tripNotBookable"));
      } else {
        setError(t("errors.unexpected"));
      }
    } catch {
      setError(t("errors.unexpected"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" onClick={handleReserve} disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {submitting ? t("actions.reserving") : t("actions.reserve")}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
