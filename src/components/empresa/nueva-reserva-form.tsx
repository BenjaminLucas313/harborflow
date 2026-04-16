"use client";

// Client form for group booking creation.
// Receives trips pre-fetched server-side — no API call needed.
//
// On trip selection: fetches /api/trips/[tripId]/availability and renders
// SeatGrid so the operator can see current occupancy before committing.
// Validates that the requested slot count does not exceed available seats.

import { useState, useEffect } from "react";
import { useRouter }            from "next/navigation";
import { Ship, ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import Link                     from "next/link";
import { SeatGrid }             from "@/components/trips/seat-grid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TripOption = {
  id:            string;
  departureTime: string;
  capacity:      number;
  boat:          { name: string };
  branch:        { name: string };
};

type Availability = {
  tripId:    string;
  capacity:  number;
  confirmed: number;
  pending:   number;
  available: number;
};

type Props = {
  trips:        TripOption[];
  presetTripId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NuevaReservaForm({ trips, presetTripId }: Props) {
  const router = useRouter();

  const [tripId,        setTripId]        = useState(presetTripId);
  const [notes,         setNotes]         = useState("");
  const [slotsCount,    setSlotsCount]    = useState(1);
  const [availability,  setAvailability]  = useState<Availability | null>(null);
  const [availLoading,  setAvailLoading]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Fetch availability whenever the selected trip changes.
  useEffect(() => {
    if (!tripId) { setAvailability(null); return; }
    let cancelled = false;
    setAvailLoading(true);
    setAvailability(null);

    fetch(`/api/trips/${tripId}/availability`)
      .then((r) => r.json())
      .then((body: { data?: Availability }) => {
        if (!cancelled) setAvailability(body.data ?? null);
      })
      .catch(() => { if (!cancelled) setAvailability(null); })
      .finally(() => { if (!cancelled) setAvailLoading(false); });

    return () => { cancelled = true; };
  }, [tripId]);

  const maxSlots   = availability?.available ?? 0;
  const overLimit  = availability !== null && slotsCount > maxSlots;
  const isFull     = availability !== null && maxSlots === 0;

  async function handleCreate() {
    if (!tripId)    { setError("Seleccioná un viaje."); return; }
    if (overLimit)  { setError("No hay suficientes asientos disponibles."); return; }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/group-bookings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        tripId,
        notes:          notes.trim() || undefined,
        slotsRequested: slotsCount,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string }; message?: string };
      if (body?.error?.code === "TRIP_CAPACITY_INSUFFICIENT") {
        setError("El viaje no tiene suficiente capacidad para la cantidad solicitada. Revisá el diagrama.");
      } else {
        setError(body?.error?.message ?? body?.message ?? "Error al crear la reserva.");
      }
      return;
    }

    const booking = await res.json() as { id: string };
    router.push(`/empresa/reservas/${booking.id}`);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/empresa/reservas" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva reserva grupal</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        {/* Trip selector */}
        <div className="space-y-1">
          <label htmlFor="tripId" className="text-sm font-medium">
            Viaje <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          {trips.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No hay viajes disponibles para reservar en este momento.
            </p>
          ) : (
            <select
              id="tripId"
              value={tripId}
              onChange={(e) => { setTripId(e.target.value); setSlotsCount(1); setError(null); }}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Seleccioná un viaje…</option>
              {trips.map((t) => {
                const dep = new Date(t.departureTime).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  weekday:  "short",
                  day:      "numeric",
                  month:    "short",
                  hour:     "2-digit",
                  minute:   "2-digit",
                });
                return (
                  <option key={t.id} value={t.id}>
                    {t.boat.name} — {dep} ({t.branch.name})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Seat diagram */}
        {tripId && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Disponibilidad de asientos</p>
            {availLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Cargando…
              </div>
            ) : availability ? (
              <>
                <SeatGrid
                  capacity={availability.capacity}
                  confirmed={availability.confirmed}
                  pending={availability.pending}
                />
                {isFull && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-sm text-red-700">Este viaje no tiene asientos disponibles.</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No se pudo cargar la disponibilidad.</p>
            )}
          </div>
        )}

        {/* Slot count */}
        {tripId && availability && !isFull && (
          <div className="space-y-1">
            <label htmlFor="slotsCount" className="text-sm font-medium">
              Cantidad de pasajeros <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="slotsCount"
              type="number"
              min={1}
              max={maxSlots}
              value={slotsCount}
              onChange={(e) => { setSlotsCount(Math.max(1, parseInt(e.target.value, 10) || 1)); setError(null); }}
              className="w-28 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {overLimit && (
              <p className="text-sm text-red-600">
                Solo quedan {maxSlots} asiento{maxSlots !== 1 ? "s" : ""} disponible{maxSlots !== 1 ? "s" : ""}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Podés agregar o quitar pasajeros individuales después de crear la reserva.
            </p>
          </div>
        )}

        {/* Optional notes */}
        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">
            Notas internas <span className="text-muted-foreground text-xs">(opcional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Observaciones para esta reserva…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={loading || !tripId || trips.length === 0 || isFull || overLimit}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Ship className="size-4" />
            {loading ? "Creando…" : "Crear reserva"}
          </button>
          <Link
            href="/empresa/reservas"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </main>
  );
}
