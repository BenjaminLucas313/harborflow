"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "OPEN",                label: "Abierto" },
  { value: "PARTIALLY_OPEN",      label: "Parcialmente abierto" },
  { value: "CLOSED_WEATHER",      label: "Cerrado — condiciones climáticas" },
  { value: "CLOSED_MAINTENANCE",  label: "Cerrado — mantenimiento" },
  { value: "CLOSED_SECURITY",     label: "Cerrado — seguridad" },
  { value: "CLOSED_OTHER",        label: "Cerrado — otro motivo" },
] as const;

type Props = {
  branches: { id: string; name: string }[];
};

export function PortStatusForm({ branches }: Props) {
  const router = useRouter();

  const [branchId,  setBranchId]  = useState(branches[0]?.id ?? "");
  const [status,    setStatus]    = useState("OPEN");
  const [message,   setMessage]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const isClosing = status !== "OPEN" && status !== "PARTIALLY_OPEN";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!branchId) {
      setError("Seleccioná un puerto.");
      return;
    }
    if (status !== "OPEN" && !message.trim()) {
      setError("El motivo es obligatorio para estados no disponibles.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/port-status", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        branchId,
        status,
        message: message.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al actualizar el estado.");
      return;
    }

    setSuccess(true);
    setMessage("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <h2 className="font-semibold text-base">Cambiar estado del puerto</h2>

      {branches.length > 1 && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Puerto</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium">Estado <span className="text-red-500">*</span></label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          Motivo / mensaje público
          {isClosing && <span className="text-red-500"> *</span>}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Ej: Puerto cerrado por vientos de hasta 60 km/h. Se estima reapertura a las 14:00 hs."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground">Este mensaje será visible para los usuarios.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Estado actualizado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Actualizando…" : "Actualizar estado"}
      </button>
    </form>
  );
}
