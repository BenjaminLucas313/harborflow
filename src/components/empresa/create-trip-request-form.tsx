"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function CreateTripRequestForm() {
  const router = useRouter();

  const [origin,         setOrigin]         = useState("");
  const [destination,    setDestination]    = useState("");
  const [requestedDate,  setRequestedDate]  = useState("");
  const [passengerCount, setPassengerCount] = useState<string>("1");
  const [notes,          setNotes]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [fieldErrors,    setFieldErrors]    = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const count = parseInt(passengerCount, 10);
    if (!origin.trim() || !destination.trim() || !requestedDate || isNaN(count) || count < 1) {
      setError("Completá los campos obligatorios.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const res = await fetch("/api/trip-requests", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        origin:         origin.trim(),
        destination:    destination.trim(),
        requestedDate:  requestedDate,
        passengerCount: count,
        notes:          notes.trim() || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.fields && typeof body.fields === "object") {
        setFieldErrors(body.fields as Record<string, string>);
      }
      setError(body.message ?? body.error ?? "Error al enviar la solicitud.");
      return;
    }

    router.push("/empresa/solicitudes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <Link
        href="/empresa/solicitudes"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver a solicitudes
      </Link>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          Origen <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="Ej: Terminal Norte"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {fieldErrors.origin && <p className="text-xs text-red-600">{fieldErrors.origin}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          Destino <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Ej: Plataforma Sur"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {fieldErrors.destination && <p className="text-xs text-red-600">{fieldErrors.destination}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Fecha y hora <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {fieldErrors.requestedDate && <p className="text-xs text-red-600">{fieldErrors.requestedDate}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Cantidad de personas <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={500}
            value={passengerCount}
            onChange={(e) => setPassengerCount(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {fieldErrors.passengerCount && <p className="text-xs text-red-600">{fieldErrors.passengerCount}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Observaciones</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Información adicional para el proveedor…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
