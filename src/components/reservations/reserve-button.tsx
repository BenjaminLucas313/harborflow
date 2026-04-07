"use client";

// Reserve button shown on each trip card in the passenger trip list.
//
// States:
//   reservationStatus !== null → status badge (CONFIRMED / WAITLISTED / CHECKED_IN)
//   isFull && !waitlistEnabled → disabled "Full" pill
//   isFull && waitlistEnabled  → "Join waitlist" button
//   otherwise                 → "Reserve" button

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { ReservationStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE_CLASSES: Record<
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
    STATUS_BADGE_CLASSES[status as keyof typeof STATUS_BADGE_CLASSES] ??
    "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
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
  /** Waitlist queue position — only set when reservationStatus === "WAITLISTED". */
  waitlistPosition?: number | null;
  /** Whether all confirmed+checked-in seats are taken. */
  isFull: boolean;
  /** Whether the trip has waitlist enabled. */
  waitlistEnabled: boolean;
};

export function ReserveButton({
  tripId,
  reservationStatus,
  waitlistPosition,
  isFull,
  waitlistEnabled,
}: Props) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already booked — show status badge, with position for waitlisted entries.
  if (reservationStatus !== null) {
    const label =
      reservationStatus === "WAITLISTED" && waitlistPosition != null
        ? `${t(`status.${reservationStatus}`)} #${waitlistPosition}`
        : t(`status.${reservationStatus}`);
    return <ReservationBadge status={reservationStatus} label={label} />;
  }

  // Full and no waitlist — non-interactive pill.
  if (isFull && !waitlistEnabled) {
    return (
      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-muted text-muted-foreground">
        {t("trips.full")}
      </span>
    );
  }

  const isWaitlist = isFull && waitlistEnabled;

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
        data.code === "TRIP_NOT_FOUND" ||
        data.code === "WAITLIST_NOT_ENABLED"
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
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={isWaitlist ? "outline" : "default"}
        onClick={handleReserve}
        disabled={submitting}
        className={
          isWaitlist
            ? "border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/20"
            : undefined
        }
      >
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {submitting
          ? isWaitlist
            ? t("actions.joining")
            : t("actions.reserving")
          : isWaitlist
            ? t("actions.joinWaitlist")
            : t("actions.reserve")}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive text-right max-w-[180px]">
          {error}
        </p>
      )}
    </div>
  );
}
