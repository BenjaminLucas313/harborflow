"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";

type StopItem = { id: number; name: string };

type Props = {
  boats:    { id: string; name: string; capacity: number }[];
  drivers:  { id: string; firstName: string; lastName: string }[];
  branches: { id: string; name: string }[];
};

let stopIdCounter = 0;
function newStop(name = ""): StopItem {
  return { id: ++stopIdCounter, name };
}

export function NewTripForm({ boats, drivers, branches }: Props) {
  const router = useRouter();

  const [boatId,          setBoatId]          = useState("");
  const [driverId,        setDriverId]        = useState("");
  const [branchId,        setBranchId]        = useState(branches[0]?.id ?? "");
  const [departure,       setDeparture]       = useState("");
  const [arrival,         setArrival]         = useState("");
  const [notes,           setNotes]           = useState("");
  const [waitlist,        setWaitlist]        = useState(true);
  const [automatizado,    setAutomatizado]    = useState(false);
  const [horaRecurrente,  setHoraRecurrente]  = useState("08:00");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [fieldErrors,     setFieldErrors]     = useState<Record<string, string>>({});

  // Stops: first and last are always origin/destination; middle ones are intermediates.
  const [stops, setStops] = useState<StopItem[]>(() => [newStop(), newStop()]);

  function updateStop(id: number, name: string) {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  function addIntermediateStop() {
    setStops((prev) => {
      const next = [...prev];
      next.splice(next.length - 1, 0, newStop());
      return next;
    });
  }

  function removeStop(id: number) {
    setStops((prev) => prev.filter((s) => s.id !== id));
  }

  // Build the stops payload only if at least origin and destination are filled.
  function buildStopsPayload() {
    const filled = stops.filter((s) => s.name.trim() !== "");
    if (filled.length < 2) return undefined;
    return stops.map((s, i) => ({ order: i, name: s.name.trim() })).filter((s) => s.name !== "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!boatId || !departure || !branchId) {
      setError("Completá los campos obligatorios.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const res = await fetch("/api/trips", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        boatId,
        driverId:             driverId || undefined,
        branchId,
        departureTime:        departure,
        estimatedArrivalTime: arrival || undefined,
        notes:                notes.trim() || undefined,
        waitlistEnabled:      waitlist,
        automatizado,
        horaRecurrente:       automatizado ? horaRecurrente : undefined,
        stops:                buildStopsPayload(),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.fields && typeof body.fields === "object") {
        setFieldErrors(body.fields as Record<string, string>);
      }
      setError(body.message ?? body.error ?? "Error al crear el viaje.");
      return;
    }

    router.push("/proveedor/viajes");
    router.refresh();
  }

  if (boats.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
        <p className="font-medium text-amber-800">No hay barcos disponibles.</p>
        <p className="text-sm text-amber-700">
          Primero creá al menos un barco en{" "}
          <Link href="/proveedor/barcos" className="underline">Barcos</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <Link href="/proveedor/viajes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a viajes
      </Link>

      <div className="space-y-1">
        <label className="text-sm font-medium">Puerto <span className="text-red-500">*</span></label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {fieldErrors.branchId && <p className="text-xs text-red-600">{fieldErrors.branchId}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Embarcación <span className="text-red-500">*</span></label>
        <select value={boatId} onChange={(e) => setBoatId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Seleccioná un barco…</option>
          {boats.map((b) => <option key={b.id} value={b.id}>{b.name} (cap. {b.capacity})</option>)}
        </select>
        {fieldErrors.boatId && <p className="text-xs text-red-600">{fieldErrors.boatId}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Conductor</label>
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Sin asignar</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
        </select>
        {fieldErrors.driverId && <p className="text-xs text-red-600">{fieldErrors.driverId}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Salida <span className="text-red-500">*</span></label>
          <input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {fieldErrors.departureTime && <p className="text-xs text-red-600">{fieldErrors.departureTime}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Llegada estimada</label>
          <input type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {fieldErrors.estimatedArrivalTime && <p className="text-xs text-red-600">{fieldErrors.estimatedArrivalTime}</p>}
        </div>
      </div>

      {/* ── Recorrido ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Recorrido <span className="text-xs font-normal text-muted-foreground">(opcional)</span></p>
        <div className="space-y-0">
          {stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === stops.length - 1;
            const isIntermediate = !isFirst && !isLast;
            return (
              <div key={stop.id} className="flex gap-2">
                {/* Timeline column */}
                <div className="flex flex-col items-center w-5 shrink-0 pt-2.5">
                  <div className={`size-3 rounded-full shrink-0 ${isFirst ? "bg-emerald-500" : isLast ? "bg-blue-500" : "bg-muted-foreground/40"}`} />
                  {!isLast && <div className="w-px flex-1 bg-border my-1 min-h-3" />}
                </div>
                {/* Input row */}
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={stop.name}
                      onChange={(e) => updateStop(stop.id, e.target.value)}
                      placeholder={isFirst ? "Punto de salida" : isLast ? "Punto de llegada" : `Parada ${idx}`}
                      className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {isIntermediate && (
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="Eliminar parada"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addIntermediateStop}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pl-7"
        >
          <Plus className="size-3.5" /> Agregar parada intermedia
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Notas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)}
          className="rounded" />
        Habilitar lista de espera
      </label>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={automatizado} onChange={(e) => setAutomatizado(e.target.checked)}
            className="rounded" />
          Automatizar viaje (se repetirá diariamente)
        </label>
        {automatizado && (
          <div className="space-y-1 pl-6">
            <label className="text-xs text-muted-foreground">Hora fija de salida (hora Argentina)</label>
            <input
              type="time"
              value={horaRecurrente}
              onChange={(e) => setHoraRecurrente(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {fieldErrors.horaRecurrente && (
              <p className="text-xs text-red-600">{fieldErrors.horaRecurrente}</p>
            )}
            <p className="text-xs text-muted-foreground">
              El job nocturno creará una copia de este viaje cada día a las 01:00 UTC con esta hora de salida.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {loading ? "Creando…" : "Crear viaje"}
      </button>
    </form>
  );
}
