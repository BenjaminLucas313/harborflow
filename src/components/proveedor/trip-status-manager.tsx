"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  SCHEDULED: [
    { value: "BOARDING",  label: "Iniciar embarque" },
    { value: "DELAYED",   label: "Marcar como demorado" },
    { value: "CANCELLED", label: "Cancelar viaje" },
  ],
  BOARDING: [
    { value: "DEPARTED",  label: "Marcar como partido" },
    { value: "DELAYED",   label: "Marcar como demorado" },
    { value: "CANCELLED", label: "Cancelar viaje" },
  ],
  DELAYED: [
    { value: "BOARDING",  label: "Iniciar embarque" },
    { value: "CANCELLED", label: "Cancelar viaje" },
  ],
  DEPARTED: [
    { value: "COMPLETED", label: "Marcar como completado" },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

const BUTTON_COLOR: Record<string, string> = {
  BOARDING:  "bg-amber-500 hover:bg-amber-600 text-white",
  DEPARTED:  "bg-blue-600 hover:bg-blue-700 text-white",
  COMPLETED: "bg-emerald-600 hover:bg-emerald-700 text-white",
  DELAYED:   "bg-orange-500 hover:bg-orange-600 text-white",
  CANCELLED: "bg-red-600 hover:bg-red-700 text-white",
};

type Props = {
  tripId:        string;
  currentStatus: string;
};

export function TripStatusManager({ tripId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const transitions = TRANSITIONS[currentStatus] ?? [];

  if (transitions.length === 0) return null;

  async function changeStatus(newStatus: string) {
    setError(null);
    setLoading(newStatus);

    const res = await fetch(`/api/trips/${tripId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: newStatus }),
    });

    setLoading(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al actualizar el estado.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Cambiar estado del viaje
      </h2>

      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button
            key={t.value}
            onClick={() => changeStatus(t.value)}
            disabled={loading !== null}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_COLOR[t.value] ?? "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
          >
            {loading === t.value ? "Actualizando…" : t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
