"use client";

// ChecklistClient — real-time boarding checklist for the assigned conductor.
// Receives initial state from the server component and handles:
//   - Optimistic checkbox toggle via PATCH /api/conductor/checkin
//   - Live "X / Y presentes" counter
//   - Departure confirmation via POST /api/conductor/confirmar-salida

import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PassengerRow {
  userId:     string;
  firstName:  string;
  lastName:   string;
  department: string | null;
}

interface Props {
  tripId:             string;
  passengers:         PassengerRow[];
  initialCheckins:    Record<string, boolean>; // userId → presente
  salidaConfirmada:   boolean;
  salidaConfirmadaAt: string | null;           // ISO string
  capacity:           number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChecklistClient({
  tripId,
  passengers,
  initialCheckins,
  salidaConfirmada: initialConfirmada,
  salidaConfirmadaAt: initialConfirmadaAt,
  capacity,
}: Props) {
  const [checkins,    setCheckins]    = useState<Record<string, boolean>>(initialCheckins);
  const [loadingIds,  setLoadingIds]  = useState<Set<string>>(new Set());
  const [confirming,  setConfirming]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [confirmed,   setConfirmed]   = useState(initialConfirmada);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initialConfirmadaAt);
  const [error,       setError]       = useState<string | null>(null);

  const presentCount = Object.values(checkins).filter(Boolean).length;
  const total        = passengers.length;
  const allPresent   = presentCount === total && total > 0;

  // ---------------------------------------------------------------------------
  // Toggle check-in
  // ---------------------------------------------------------------------------

  async function handleToggle(userId: string) {
    if (confirmed) return;

    const prev    = checkins[userId] ?? false;
    const next    = !prev;

    // Optimistic update
    setCheckins((c) => ({ ...c, [userId]: next }));
    setLoadingIds((s) => new Set(s).add(userId));

    try {
      const res = await fetch("/api/conductor/checkin", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tripId, userId, presente: next }),
      });
      if (!res.ok) {
        // Revert on failure
        setCheckins((c) => ({ ...c, [userId]: prev }));
        const json = await res.json().catch(() => ({})) as { error?: { message: string } };
        setError(json.error?.message ?? "Error al actualizar presencia.");
      } else {
        setError(null);
      }
    } catch {
      setCheckins((c) => ({ ...c, [userId]: prev }));
      setError("Error de red. Intentá de nuevo.");
    } finally {
      setLoadingIds((s) => { const next = new Set(s); next.delete(userId); return next; });
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm departure
  // ---------------------------------------------------------------------------

  async function handleConfirmar() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/conductor/confirmar-salida", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tripId }),
      });
      const json = await res.json() as { data?: { salidaConfirmadaAt?: string }; error?: { message: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Error al confirmar salida.");
      } else {
        setConfirmed(true);
        setConfirmedAt(json.data?.salidaConfirmadaAt ?? new Date().toISOString());
        setConfirming(false);
      }
    } catch {
      setError("Error de red al confirmar salida.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    });
  }

  return (
    <div className="space-y-4">

      {/* ── Live counter ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          Pasajeros presentes
        </div>
        <span
          className={`text-xl font-bold tabular-nums ${
            allPresent ? "text-emerald-600" : presentCount > 0 ? "text-amber-600" : "text-muted-foreground"
          }`}
        >
          {presentCount}
          <span className="text-base font-normal text-muted-foreground"> / {total}</span>
        </span>
      </div>

      {/* ── Passenger list ───────────────────────────────────────────── */}
      {passengers.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl">
          No hay pasajeros confirmados en este viaje.
        </div>
      ) : (
        <ul className="space-y-2">
          {passengers.map((p) => {
            const presente = checkins[p.userId] ?? false;
            const loading  = loadingIds.has(p.userId);
            const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

            return (
              <li key={p.userId}>
                <button
                  type="button"
                  onClick={() => handleToggle(p.userId)}
                  disabled={loading || confirmed}
                  className={`
                    w-full flex items-center gap-3 rounded-xl border px-4 py-3.5
                    text-left transition-colors active:scale-[0.99]
                    disabled:opacity-60
                    ${presente
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-border bg-card hover:bg-muted/40"
                    }
                  `}
                  aria-pressed={presente}
                  aria-label={`${p.firstName} ${p.lastName} — ${presente ? "presente" : "pendiente"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`size-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      presente ? "bg-emerald-200 text-emerald-800" : "bg-muted text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>

                  {/* Name + dept */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight">
                      {p.firstName} {p.lastName}
                    </p>
                    {p.department && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.department}</p>
                    )}
                  </div>

                  {/* State icon */}
                  <div className="shrink-0">
                    {loading ? (
                      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                    ) : presente ? (
                      <CheckCircle2 className="size-6 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Circle className="size-6 text-muted-foreground/40" aria-hidden="true" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* ── Departure confirmation ───────────────────────────────────── */}
      {confirmed ? (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4 text-center space-y-1">
          <CheckCircle2 className="mx-auto size-8 text-emerald-500" aria-hidden="true" />
          <p className="font-bold text-emerald-800">Salida confirmada</p>
          {confirmedAt && (
            <p className="text-sm text-emerald-700">
              {presentCount} / {capacity} pasajeros · {fmtTime(confirmedAt)}
            </p>
          )}
        </div>
      ) : presentCount > 0 ? (
        confirming ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-center font-semibold text-amber-900">
              ¿Confirmar salida con {presentCount} / {capacity} pasajeros?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-border bg-background py-3 text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting
                  ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  : null
                }
                {submitting ? "Confirmando…" : "Sí, partir"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`
              w-full rounded-2xl py-4 text-base font-bold text-white transition
              active:scale-[0.98]
              ${allPresent
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-500 hover:bg-amber-600"
              }
            `}
          >
            {allPresent
              ? `✓ Todos abordaron — Confirmar salida`
              : `Partir con ${presentCount} / ${capacity}`
            }
          </button>
        )
      ) : null}
    </div>
  );
}
