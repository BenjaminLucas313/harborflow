"use client";

// Cancel action for a passenger's reservation or waitlist entry.
//
// type="reservation" → DELETE /api/reservations/[reservationId]
// type="waitlist"    → DELETE /api/reservations/waitlist/[entryId]
//
// On success: router.refresh() triggers the server component to re-fetch data.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props =
  | { type: "reservation"; reservationId: string }
  | { type: "waitlist"; entryId: string };

export function CancelReservationButton(props: Props) {
  const t = useTranslations("reservations.cancel");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label =
    props.type === "reservation"
      ? t("cancelReservation")
      : t("leaveWaitlist");

  const url =
    props.type === "reservation"
      ? `/api/reservations/${props.reservationId}`
      : `/api/reservations/waitlist/${props.entryId}`;

  const handleCancel = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(url, { method: "DELETE" });

      if (res.ok) {
        router.refresh();
        return;
      }

      setError(t("unexpected"));
    } catch {
      setError(t("unexpected"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleCancel}
        disabled={submitting}
      >
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {submitting ? t("cancelling") : label}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
