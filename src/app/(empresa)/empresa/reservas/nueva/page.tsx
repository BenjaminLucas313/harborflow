"use client";

// /empresa/reservas/nueva — select a trip and create a GroupBooking

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ship, ArrowLeft } from "lucide-react";
import Link from "next/link";

type TripOption = {
  id:            string;
  departureTime: string;
  capacity:      number;
  boat:          { name: string };
  branch:        { name: string };
};

export default function NuevaReserva() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const presetTripId = searchParams.get("tripId") ?? "";

  const [trips, setTrips]     = useState<TripOption[]>([]);
  const [tripId, setTripId]   = useState(presetTripId);
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then((data: TripOption[]) => setTrips(data))
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!tripId) { setError("Seleccioná un viaje."); return; }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/group-bookings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tripId, notes: notes.trim() || undefined }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al crear la reserva.");
      return;
    }

    const booking = await res.json();
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
          <select
            id="tripId"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
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
        </div>

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
            disabled={loading || !tripId}
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
