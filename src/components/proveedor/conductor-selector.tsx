"use client";

// ConductorSelector — dropdown to assign/unassign a driver to a trip.
// Renders as a <select> that PATCHes /api/trips/[tripId] on change.
// Shows an inline success/error state without a full page reload.

import { useState } from "react";
import { Loader2 }  from "lucide-react";

export type ConductorOption = {
  id:        string;
  firstName: string;
  lastName:  string;
  hasUser:   boolean;
};

type Props = {
  tripId:          string;
  currentDriverId: string | null;
  drivers:         ConductorOption[];
};

export function ConductorSelector({ tripId, currentDriverId, drivers }: Props) {
  const [selected, setSelected] = useState<string>(currentDriverId ?? "");
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleChange(newDriverId: string) {
    setSelected(newDriverId);
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ driverId: newDriverId || null }),
      });
      const json = await res.json() as { error?: { message: string } };

      if (!res.ok) {
        setFeedback({ ok: false, msg: json.error?.message ?? "Error al asignar conductor." });
        setSelected(currentDriverId ?? "");
      } else {
        setFeedback({ ok: true, msg: "Conductor actualizado." });
      }
    } catch {
      setFeedback({ ok: false, msg: "Error de red." });
      setSelected(currentDriverId ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Asignar conductor"
        >
          <option value="">Sin conductor</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.firstName} {d.lastName}
              {d.hasUser ? " ✓" : ""}
            </option>
          ))}
        </select>

        {saving && (
          <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" aria-hidden="true" />
        )}
      </div>

      {feedback && (
        <p
          className={`text-xs ${feedback.ok ? "text-emerald-600" : "text-red-600"}`}
          role="status"
        >
          {feedback.msg}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Conductores marcados con ✓ tienen cuenta de acceso activa.
      </p>
    </div>
  );
}
