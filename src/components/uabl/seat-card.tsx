"use client";
// SeatCard — colored card showing a seat's status on the UABL seat map.
// Blue = PENDING (actionable), Green = CONFIRMED, Red = REJECTED.
// canAct = true only when the seat's departmentId matches the current user's departmentId.

import { useState } from "react";
import { useRouter } from "next/navigation";

type SeatData = {
  id: string;
  status: string;
  employee: { firstName: string; lastName: string };
  workType: { name: string };
  department: { name: string };
  companyName: string;
  rejectionNote?: string | null;
  confirmedBy?: { firstName: string; lastName: string } | null;
  confirmedAt?: Date | null;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "border-blue-300 bg-blue-50",
  CONFIRMED: "border-emerald-300 bg-emerald-50",
  REJECTED:  "border-red-300 bg-red-50",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING:   { label: "Pendiente",  className: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmado", className: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "Rechazado",  className: "bg-red-100 text-red-700" },
};

export function SeatCard({
  seat,
  canAct,
}: {
  seat: SeatData;
  canAct: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cardStyle = STATUS_STYLES[seat.status] ?? "border-gray-200 bg-white";
  const badge = STATUS_BADGE[seat.status];

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/seat-requests/${seat.id}/confirm`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al confirmar");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/seat-requests/${seat.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionNote: rejectionNote || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al rechazar");
        return;
      }
      setShowRejectForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${cardStyle}`}>
      {/* Name + company */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">
            {seat.employee.firstName} {seat.employee.lastName}
          </p>
          <p className="text-xs text-gray-500">{seat.companyName}</p>
        </div>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Work type */}
      <p className="mt-2 text-xs text-gray-600">{seat.workType.name}</p>
      <p className="text-xs text-gray-400">{seat.department.name}</p>

      {/* Rejection note */}
      {seat.status === "REJECTED" && seat.rejectionNote && (
        <p className="mt-2 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
          {seat.rejectionNote}
        </p>
      )}

      {/* Actions — only shown when UABL staff can act on this seat */}
      {canAct && seat.status === "PENDING" && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {!showRejectForm ? (
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? "…" : "Confirmar"}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Motivo del rechazo (opcional)"
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {loading ? "…" : "Confirmar rechazo"}
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setError(null); }}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmed by */}
      {seat.status === "CONFIRMED" && seat.confirmedBy && (
        <p className="mt-2 text-xs text-emerald-600">
          ✓ {seat.confirmedBy.firstName} {seat.confirmedBy.lastName}
        </p>
      )}
    </div>
  );
}
