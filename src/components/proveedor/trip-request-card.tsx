"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ChevronDown, Clock, Users, MapPin, Calendar } from "lucide-react";

type Boat = { id: string; name: string; capacity: number };

type TripRequestRow = {
  id:             string;
  origin:         string;
  destination:    string;
  requestedDate:  string;
  passengerCount: number;
  notes:          string | null;
  status:         string;
  rejectionNote:  string | null;
  requestedBy:    { firstName: string; lastName: string; email: string };
};

type Props = {
  request: TripRequestRow;
  boats:   Boat[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "Pendiente",
  ACCEPTED:  "Aceptada",
  REJECTED:  "Rechazada",
  CANCELLED: "Cancelada",
  FULFILLED: "Completada",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-blue-100 text-blue-700",
  ACCEPTED:  "bg-emerald-100 text-emerald-700",
  FULFILLED: "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function TripRequestCard({ request, boats }: Props) {
  const router = useRouter();

  const [selectedBoat,   setSelectedBoat]   = useState("");
  const [rejectionNote,  setRejectionNote]  = useState("");
  const [showAccept,     setShowAccept]     = useState(false);
  const [showReject,     setShowReject]     = useState(false);
  const [loading,        setLoading]        = useState<"accept" | "reject" | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [fieldErrors,    setFieldErrors]    = useState<Record<string, string>>({});

  const isPending = request.status === "PENDING";

  async function handleReview(action: "ACCEPT" | "REJECT") {
    if (action === "ACCEPT" && !selectedBoat) {
      setFieldErrors((f) => ({ ...f, boatId: "Seleccioná una embarcación." }));
      return;
    }
    if (action === "REJECT" && !rejectionNote.trim()) {
      setFieldErrors((f) => ({ ...f, rejectionNote: "Ingresá un motivo." }));
      return;
    }

    setLoading(action === "ACCEPT" ? "accept" : "reject");
    setError(null);
    setFieldErrors({});

    const res = await fetch(`/api/trip-requests/${request.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action,
        boatId:        action === "ACCEPT" ? selectedBoat : undefined,
        rejectionNote: action === "REJECT" ? rejectionNote.trim() : undefined,
      }),
    });

    setLoading(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.fields && typeof body.fields === "object") {
        setFieldErrors(body.fields as Record<string, string>);
      }
      setError(body.message ?? body.error ?? "Error al procesar la solicitud.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="size-4 text-muted-foreground shrink-0" />
            <span>{request.origin}</span>
            <span className="text-muted-foreground">→</span>
            <span>{request.destination}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(request.requestedDate).toLocaleString("es-AR", {
                day:    "2-digit",
                month:  "2-digit",
                year:   "numeric",
                hour:   "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {request.passengerCount} persona{request.passengerCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Solicitado por {request.requestedBy.firstName} {request.requestedBy.lastName}
          </p>
        </div>

        <span
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
            STATUS_STYLES[request.status] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {request.status === "PENDING"
            ? <Clock className="size-3" />
            : request.status === "FULFILLED" || request.status === "ACCEPTED"
            ? <CheckCircle2 className="size-3" />
            : <XCircle className="size-3" />}
          {STATUS_LABELS[request.status] ?? request.status}
        </span>
      </div>

      {/* Notes */}
      {request.notes && (
        <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
          {request.notes}
        </p>
      )}

      {/* Rejection note (already rejected) */}
      {request.status === "REJECTED" && request.rejectionNote && (
        <p className="text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="font-medium text-red-700">Motivo:</span>{" "}
          {request.rejectionNote}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions — only for PENDING */}
      {isPending && (
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAccept((v) => !v); setShowReject(false); }}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="size-4" />
              Aceptar
              <ChevronDown className={`size-3.5 transition-transform ${showAccept ? "rotate-180" : ""}`} />
            </button>

            <button
              onClick={() => { setShowReject((v) => !v); setShowAccept(false); }}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="size-4" />
              Rechazar
              <ChevronDown className={`size-3.5 transition-transform ${showReject ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Accept form */}
          {showAccept && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <label className="text-xs font-medium text-emerald-800">
                Embarcación asignada <span aria-hidden="true">*</span>
              </label>
              <select
                value={selectedBoat}
                onChange={(e) => setSelectedBoat(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Seleccioná una embarcación…</option>
                {boats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (cap. {b.capacity})
                  </option>
                ))}
              </select>
              {fieldErrors.boatId && <p className="text-xs text-red-600">{fieldErrors.boatId}</p>}
              <button
                onClick={() => handleReview("ACCEPT")}
                disabled={!!loading || !selectedBoat}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading === "accept" ? "Aceptando…" : "Confirmar aceptación"}
              </button>
            </div>
          )}

          {/* Reject form */}
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
              {fieldErrors.rejectionNote && <p className="text-xs text-red-600">{fieldErrors.rejectionNote}</p>}
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
