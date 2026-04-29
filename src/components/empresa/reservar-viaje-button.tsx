"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, X, Ship } from "lucide-react";

const TZ = "America/Argentina/Buenos_Aires";

function isTripToday(iso: string): boolean {
  const dep = new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ });
  const now = new Date().toLocaleDateString("es-AR", { timeZone: TZ });
  return dep === now;
}

// "lunes 5 de mayo" — no year, no time, as specified
function formatDepartureShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });
}

// ---------------------------------------------------------------------------
// Confirmation modal — shown only when the trip is NOT today
// ---------------------------------------------------------------------------

type ModalProps = {
  departureTime:  string;
  boatName:       string;
  availableSeats: number;
  onConfirm:      () => void;
  onCancel:       () => void;
};

function FechaFuturaModal({
  departureTime,
  boatName,
  availableSeats,
  onConfirm,
  onCancel,
}: ModalProps) {
  const fechaCorta = formatDepartureShort(departureTime);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/60 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 motion-reduce:animate-none relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">

        {/* Amber header */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 pt-6 pb-5 text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-amber-100 p-4 shadow-sm">
              <CalendarClock className="size-8 text-amber-600" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h2 id="modal-title" className="text-lg font-semibold leading-snug">
              Este viaje no es para hoy
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {boatName}
              {" · "}
              {availableSeats} lugar{availableSeats !== 1 ? "es" : ""} disponible{availableSeats !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p
            id="modal-desc"
            className="text-sm text-center text-muted-foreground leading-relaxed"
          >
            El viaje para el cual estás a punto de reservar no es para hoy, es
            para{" "}
            <span className="font-semibold text-foreground capitalize">
              {fechaCorta}
            </span>
            . ¿Seguro que querés continuar?
          </p>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Ship className="size-4" aria-hidden="true" />
              Sí, continuar
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component — replaces the <Link> in the viajes list
// ---------------------------------------------------------------------------

type Props = {
  tripId:         string;
  departureTime:  string; // ISO string serialized by the server component
  availableSeats: number;
  boatName:       string;
};

export function ReservarViajeButton({
  tripId,
  departureTime,
  availableSeats,
  boatName,
}: Props) {
  const router      = useRouter();
  const [open, setOpen] = useState(false);

  const destination = `/empresa/reservas/nueva?tripId=${tripId}`;

  function handleClick() {
    if (isTripToday(departureTime)) {
      router.push(destination);
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Crear reserva grupal
      </button>

      {open && (
        <FechaFuturaModal
          departureTime={departureTime}
          boatName={boatName}
          availableSeats={availableSeats}
          onConfirm={() => { setOpen(false); router.push(destination); }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
