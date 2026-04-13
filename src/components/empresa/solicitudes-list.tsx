"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Users, Calendar, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TripRequestWithRelations } from "@/modules/trip-requests/repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  PENDING:   "Pendiente",
  FULFILLED: "Completada",
  REJECTED:  "Rechazada",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-blue-100 text-blue-700",
  FULFILLED: "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-red-100 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-600",
};

/** Statuses from which the EMPRESA user can initiate a self-cancel. */
const CANCELLABLE_STATUSES = new Set(["PENDING", "FULFILLED"]);

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

type ConfirmDialogProps = {
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
};

function ConfirmDialog({ onConfirm, onCancel, isPending }: ConfirmDialogProps) {
  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="size-5 text-red-600" />
          </div>
          <div>
            <h2 id="cancel-dialog-title" className="font-semibold text-base">
              ¿Cancelar solicitud?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta acción no se puede deshacer. Si la solicitud ya fue completada,
              también se cancelarán los lugares asignados a UABL.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Cancelando…" : "Confirmar cancelación"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  requests: TripRequestWithRelations[];
};

export function SolicitudesList({ requests }: Props) {
  const router = useRouter();
  const [confirmId, setConfirmId]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();

  function openConfirm(id: string) {
    setErrorMsg(null);
    setConfirmId(id);
  }

  function closeConfirm() {
    if (!isPending) setConfirmId(null);
  }

  function handleConfirm() {
    if (!confirmId) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/solicitudes/${confirmId}`, {
          method: "DELETE",
        });

        const body = await res.json() as {
          data?: unknown;
          error?: { code: string; message: string };
        };

        if (!res.ok) {
          setErrorMsg(body.error?.message ?? "Error al cancelar la solicitud.");
          setConfirmId(null);
          return;
        }

        setConfirmId(null);
        // Revalidate — server component will re-fetch the updated list.
        router.refresh();
      } catch {
        setErrorMsg("No se pudo conectar con el servidor. Intentá de nuevo.");
        setConfirmId(null);
      }
    });
  }

  return (
    <>
      {/* Global error banner */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
            aria-label="Cerrar error"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmId && (
        <ConfirmDialog
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
          isPending={isPending}
        />
      )}

      {/* List */}
      {requests.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Todavía no enviaste ninguna solicitud.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="rounded-2xl border border-border bg-card p-5 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-4 text-muted-foreground shrink-0" />
                    {req.origin} → {req.destination}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(req.requestedDate).toLocaleString("es-AR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {req.passengerCount} persona{req.passengerCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      STATUS_COLOR[req.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STATUS_LABEL[req.status] ?? req.status}
                  </span>

                  {CANCELLABLE_STATUSES.has(req.status) && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => openConfirm(req.id)}
                      disabled={isPending}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {req.status === "REJECTED" && req.rejectionNote && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <span className="font-medium">Motivo del rechazo:</span>{" "}
                  {req.rejectionNote}
                </p>
              )}

              {req.status === "FULFILLED" && req.tripId && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  Viaje generado — el proveedor confirmó la asignación de embarcación.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
