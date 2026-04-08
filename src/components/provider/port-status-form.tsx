"use client";

// Client component — lets the PROVIDER change the port status via the API.
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "OPEN",               label: "Abierto" },
  { value: "PARTIALLY_OPEN",     label: "Parcialmente abierto" },
  { value: "CLOSED_WEATHER",     label: "Cerrado — Clima" },
  { value: "CLOSED_MAINTENANCE", label: "Cerrado — Mantenimiento" },
  { value: "CLOSED_SECURITY",    label: "Cerrado — Seguridad" },
  { value: "CLOSED_OTHER",       label: "Cerrado — Otro motivo" },
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

interface PortStatusFormProps {
  branchId: string;
  companyId: string;
  currentStatus: string;
}

export function PortStatusForm({ branchId, companyId, currentStatus }: PortStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusValue>(
    (STATUS_OPTIONS.find((o) => o.value === currentStatus)?.value ?? "OPEN") as StatusValue,
  );
  const [message, setMessage] = useState("");
  const [estimatedReopeningAt, setEstimatedReopeningAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresMessage = status !== "OPEN";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (requiresMessage && !message.trim()) {
      setError("Ingresá el motivo del cierre.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/port-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          companyId,
          status,
          message: message.trim() || undefined,
          estimatedReopeningAt: estimatedReopeningAt || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? "Error al actualizar el estado.");
        return;
      }

      // Reset form and refresh server data.
      setMessage("");
      setEstimatedReopeningAt("");
      router.refresh();
    } catch {
      setError("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Cambiar estado</h2>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
          {error}
        </p>
      )}

      {/* Status selector */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusValue)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Message — required for non-OPEN */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Motivo / Mensaje público
          {requiresMessage && <span className="ml-1 text-red-500">*</span>}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={requiresMessage ? "Describí el motivo del cierre..." : "Opcional"}
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Estimated reopening — only relevant for closed states */}
      {requiresMessage && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Reapertura estimada <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="datetime-local"
            value={estimatedReopeningAt}
            onChange={(e) => setEstimatedReopeningAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Actualizar estado"}
      </button>
    </form>
  );
}
