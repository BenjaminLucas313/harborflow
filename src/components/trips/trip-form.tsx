"use client";

// Collapsible create-trip form — shared between operator and admin trip pages.
// Uses the "trips" i18n namespace.
// On success: resets, collapses, and triggers a server component refresh.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus, X } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Prop types — plain serialisable objects passed from the server component
// ---------------------------------------------------------------------------

export type BoatOption = { id: string; name: string; capacity: number };
export type DriverOption = { id: string; firstName: string; lastName: string };

// ---------------------------------------------------------------------------
// Client-side form schema
// companyId is intentionally excluded — the server always derives it from session.
// ---------------------------------------------------------------------------

const FormSchema = z.object({
  boatId: z.string().min(1),
  driverId: z.string().optional(),
  departureTime: z.string().min(1),
  estimatedArrivalTime: z.string().optional(),
  waitlistEnabled: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  boats: BoatOption[];
  drivers: DriverOption[];
  branchId: string;
  /** Forwarded from session so the POST body satisfies the API's Zod schema.
   *  The server unconditionally overrides this from the session — never trusted. */
  companyId: string;
};

export function TripForm({ boats, drivers, branchId, companyId }: Props) {
  const t = useTranslations("trips");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { waitlistEnabled: true },
  });

  const onSubmit = async (data: FormValues) => {
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // companyId satisfies the API schema validation step; server overrides it.
        companyId,
        branchId,
        boatId: data.boatId,
        ...(data.driverId ? { driverId: data.driverId } : {}),
        departureTime: data.departureTime,
        ...(data.estimatedArrivalTime
          ? { estimatedArrivalTime: data.estimatedArrivalTime }
          : {}),
        waitlistEnabled: data.waitlistEnabled,
        ...(data.notes ? { notes: data.notes } : {}),
      }),
    });

    if (!res.ok) {
      setError("root", { message: t("form.errors.unexpected") });
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  };

  const handleCancel = () => {
    reset();
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Trigger — shown only when the form panel is closed */}
      {!open && (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          {t("createTrip")}
        </Button>
      )}

      {/* Inline form panel */}
      {open && (
        <div className="rounded-xl border border-border bg-card px-6 py-6 shadow-sm">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">{t("form.title")}</h2>
            <button
              type="button"
              onClick={handleCancel}
              aria-label={t("form.actions.cancel")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* No-boats warning */}
          {boats.length === 0 && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {t("form.errors.noBoats")}
            </p>
          )}

          {/* Root API error */}
          {errors.root && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
            >
              {errors.root.message}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* ── Boat ──────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-boatId">{t("form.fields.boat")}</Label>
              <select
                id="tf-boatId"
                disabled={boats.length === 0}
                aria-invalid={!!errors.boatId}
                aria-describedby={errors.boatId ? "tf-boatId-error" : undefined}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
                {...register("boatId")}
              >
                <option value="">{t("form.placeholders.selectBoat")}</option>
                {boats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.capacity} pax)
                  </option>
                ))}
              </select>
              {errors.boatId && (
                <p id="tf-boatId-error" role="alert" className="text-sm text-destructive">
                  {errors.boatId.message}
                </p>
              )}
            </div>

            {/* ── Driver ────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-driverId">{t("form.fields.driver")}</Label>
              <select
                id="tf-driverId"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register("driverId")}
              >
                <option value="">{t("form.placeholders.selectDriver")}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Departure + Arrival ────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tf-departureTime">{t("form.fields.departureTime")}</Label>
                <Input
                  id="tf-departureTime"
                  type="datetime-local"
                  aria-invalid={!!errors.departureTime}
                  aria-describedby={
                    errors.departureTime ? "tf-departure-error" : undefined
                  }
                  {...register("departureTime")}
                />
                {errors.departureTime && (
                  <p id="tf-departure-error" role="alert" className="text-sm text-destructive">
                    {errors.departureTime.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tf-estimatedArrivalTime">
                  {t("form.fields.estimatedArrivalTime")}
                </Label>
                <Input
                  id="tf-estimatedArrivalTime"
                  type="datetime-local"
                  {...register("estimatedArrivalTime")}
                />
              </div>
            </div>

            {/* ── Waitlist ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              <input
                id="tf-waitlistEnabled"
                type="checkbox"
                className="size-4 rounded border-input accent-primary cursor-pointer"
                {...register("waitlistEnabled")}
              />
              <Label htmlFor="tf-waitlistEnabled" className="cursor-pointer font-normal">
                {t("form.fields.waitlistEnabled")}
              </Label>
            </div>

            {/* ── Notes ─────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-notes">{t("form.fields.notes")}</Label>
              <textarea
                id="tf-notes"
                rows={3}
                placeholder={t("form.placeholders.notes")}
                className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register("notes")}
              />
            </div>

            {/* ── Actions ───────────────────────────────────────────────── */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                {t("form.actions.cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || boats.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    {t("form.actions.submitting")}
                  </>
                ) : (
                  t("form.actions.submit")
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
