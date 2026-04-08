"use client";

// SlotReviewCard — UABL component to confirm or reject a PassengerSlot.
// Shows passenger name, work type, and action buttons (confirm / reject with note).

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, ChevronDown } from "lucide-react";
import type { SlotWithRelations } from "@/modules/passenger-slots/repository";

type Props = {
  slot: SlotWithRelations;
};

export function SlotReviewCard({ slot }: Props) {
  const [rejectionNote, setRejectionNote] = useState("");
  const [showReject, setShowReject]       = useState(false);
  const [loading, setLoading]             = useState<"confirm" | "reject" | null>(null);
  const [result, setResult]               = useState<"confirmed" | "rejected" | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  const isPending = slot.status === "PENDING" && !result;

  async function handleReview(action: "CONFIRM" | "REJECT") {
    if (action === "REJECT" && !rejectionNote.trim()) {
      setError("Ingresá un motivo para el rechazo.");
      return;
    }
    setLoading(action === "CONFIRM" ? "confirm" : "reject");
    setError(null);

    const res = await fetch(`/api/slots/${slot.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action, rejectionNote: rejectionNote.trim() || undefined }),
    });

    setLoading(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al procesar la acción.");
      return;
    }

    setResult(action === "CONFIRM" ? "confirmed" : "rejected");
    setShowReject(false);
  }

  const statusLabel =
    result === "confirmed"  ? "Confirmado"
    : result === "rejected" ? "Rechazado"
    : slot.status === "CONFIRMED" ? "Confirmado"
    : slot.status === "REJECTED"  ? "Rechazado"
    : slot.status === "CANCELLED" ? "Cancelado"
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      {/* Passenger info */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {slot.usuario.firstName} {slot.usuario.lastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {slot.workType.name}{" "}
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
              {slot.workType.code}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Representa: {slot.representedCompany}
          </p>
        </div>

        {/* Current status badge (non-pending) */}
        {!isPending && statusLabel && (
          <span
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
              (result ?? slot.status) === "confirmed" || slot.status === "CONFIRMED"
                ? "bg-emerald-100 text-emerald-700"
                : (result ?? slot.status) === "rejected" || slot.status === "REJECTED"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {(result ?? slot.status) === "confirmed" || slot.status === "CONFIRMED"
              ? <CheckCircle2 className="size-3" />
              : <XCircle className="size-3" />}
            {statusLabel}
          </span>
        )}

        {/* Pending badge */}
        {isPending && (
          <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 shrink-0">
            <Clock className="size-3" />
            Pendiente
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Rejection note display (already rejected) */}
      {slot.status === "REJECTED" && slot.rejectionNote && !result && (
        <p className="text-sm text-muted-foreground bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="font-medium text-red-700">Motivo:</span>{" "}
          {slot.rejectionNote}
        </p>
      )}

      {/* Actions — only for pending slots */}
      {isPending && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleReview("CONFIRM")}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="size-4" />
              {loading === "confirm" ? "Confirmando…" : "Confirmar"}
            </button>

            <button
              onClick={() => setShowReject((v) => !v)}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="size-4" />
              Rechazar
              <ChevronDown
                className={`size-3.5 transition-transform ${showReject ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Rejection form */}
          {showReject && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <label className="text-xs font-medium text-red-700">
                Motivo del rechazo <span aria-hidden="true">*</span>
              </label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={2}
                placeholder="Describí el motivo del rechazo…"
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={() => handleReview("REJECT")}
                disabled={!!loading || !rejectionNote.trim()}
                className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading === "reject" ? "Rechazando…" : "Confirmar rechazo"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
