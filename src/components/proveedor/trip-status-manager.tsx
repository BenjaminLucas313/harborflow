"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  SCHEDULED: [
    { value: "BOARDING",  label: "Iniciar embarque" },
    { value: "DELAYED",   label: "Marcar como demorado" },
  ],
  BOARDING: [
    { value: "DEPARTED",  label: "Marcar como partido" },
    { value: "DELAYED",   label: "Marcar como demorado" },
  ],
  DELAYED: [
    { value: "BOARDING",  label: "Iniciar embarque" },
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
};

type ConfirmModal = {
  title:      string;
  body:       string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm:  () => Promise<void>;
};

type Props = {
  tripId:        string;
  currentStatus: string;
  automatizado:  boolean;
};

export function TripStatusManager({ tripId, currentStatus, automatizado }: Props) {
  const router = useRouter();
  const [loading,      setLoading]      = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [modal,        setModal]        = useState<ConfirmModal | null>(null);
  const [modalPending, setModalPending] = useState(false);

  const transitions = TRANSITIONS[currentStatus] ?? [];
  const isCancellable = ["SCHEDULED", "BOARDING", "DELAYED"].includes(currentStatus);

  async function changeStatus(newStatus: string, extra?: Record<string, unknown>) {
    setError(null);
    setLoading(newStatus);

    const res = await fetch(`/api/trips/${tripId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: newStatus, ...extra }),
    });

    setLoading(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al actualizar el estado.");
      return;
    }

    router.refresh();
  }

  async function desautomatizar() {
    setError(null);
    setModalPending(true);

    const res = await fetch(`/api/trips/${tripId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "DESAUTOMATIZAR" }),
    });

    setModalPending(false);
    setModal(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al desautomatizar la serie.");
      return;
    }

    router.refresh();
  }

  function openDeleteModal() {
    setModal({
      title:        "¿Eliminar viaje?",
      body:         "Esta acción cancela el viaje y no puede deshacerse. Los pasajeros asignados serán notificados.",
      confirmLabel: "Eliminar viaje",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
      onConfirm:    () => changeStatus("CANCELLED", { isDeleteRequest: true }),
    });
  }

  function openDesautomatizarModal() {
    setModal({
      title:        "¿Desautomatizar serie?",
      body:         "Se detendrá la creación automática de este viaje para los días siguientes. Los viajes ya creados no se ven afectados.",
      confirmLabel: "Desautomatizar",
      confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
      onConfirm:    desautomatizar,
    });
  }

  async function handleModalConfirm() {
    if (!modal) return;
    setModalPending(true);
    await modal.onConfirm();
    setModalPending(false);
    setModal(null);
  }

  const hasActions = transitions.length > 0 || isCancellable || automatizado;
  if (!hasActions) return null;

  return (
    <>
      {/* Confirmation modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-base">{modal.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{modal.body}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModal(null)}
                disabled={modalPending}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={modalPending}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${modal.confirmClass}`}
              >
                {modalPending ? "Procesando…" : modal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Gestionar viaje
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

          {automatizado && (
            <button
              onClick={openDesautomatizarModal}
              disabled={loading !== null}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              Desautomatizar serie
            </button>
          )}

          {isCancellable && (
            <button
              onClick={openDeleteModal}
              disabled={loading !== null}
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Eliminar viaje
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
