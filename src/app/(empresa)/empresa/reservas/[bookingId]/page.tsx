import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { findGroupBookingById } from "@/modules/group-bookings/repository";
import { prisma } from "@/lib/prisma";
import { CheckCircle2, Clock, XCircle, Plus } from "lucide-react";
import { SubmitBookingButton } from "@/components/empresa/submit-booking-button";
import { AddSlotPanel } from "@/components/empresa/add-slot-panel";
import { SeatGrid } from "@/components/trips/seat-grid";

type SlotCfg = { label: string; icon: typeof Clock; color: string };
const SLOT_STATUS_DEFAULT: SlotCfg = { label: "Pendiente", icon: Clock, color: "text-blue-700" };
const SLOT_STATUS: Record<string, SlotCfg> = {
  PENDING:   { label: "Pendiente", icon: Clock,         color: "text-blue-700" },
  CONFIRMED: { label: "Confirmado", icon: CheckCircle2, color: "text-emerald-700" },
  REJECTED:  { label: "Rechazado", icon: XCircle,       color: "text-red-600" },
  CANCELLED: { label: "Cancelado", icon: XCircle,       color: "text-slate-500" },
};

export default async function BookingDetail({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { bookingId } = await params;
  const booking = await findGroupBookingById(bookingId);

  if (!booking || booking.companyId !== session.user.companyId) notFound();
  if (booking.employerId !== session.user.employerId) notFound();

  const trip = await prisma.trip.findUnique({
    where:  { id: booking.tripId },
    select: {
      departureTime: true,
      capacity:      true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
    },
  });

  const pendingSlots   = booking.passengerSlots.filter((s) => s.status === "PENDING").length;
  const confirmedSlots = booking.passengerSlots.filter((s) => s.status === "CONFIRMED").length;
  const occupied       = pendingSlots + confirmedSlots;
  const available      = (trip?.capacity ?? 0) - occupied;

  const departure = trip
    ? new Date(trip.departureTime).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday:  "long",
        day:      "numeric",
        month:    "long",
        year:     "numeric",
        hour:     "2-digit",
        minute:   "2-digit",
      })
    : "—";

  const isDraft = booking.status === "DRAFT";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{trip?.boat.name ?? "Viaje"}</h1>
        <p className="text-sm text-muted-foreground">{departure} · {trip?.branch.name}</p>
        <p className="text-xs text-muted-foreground">
          {available} lugar{available !== 1 ? "es" : ""} disponible{available !== 1 ? "s" : ""} · {occupied}/{trip?.capacity ?? "—"} ocupados
        </p>
      </div>

      {/* Seat occupancy grid — additive visual reference */}
      {trip && (
        <div className="rounded-xl border border-border bg-muted/40 px-5 py-4">
          <SeatGrid capacity={trip.capacity} confirmed={confirmedSlots} pending={pendingSlots} />
        </div>
      )}

      {/* Status + actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${
          booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" :
          booking.status === "SUBMITTED" || booking.status === "PARTIAL" ? "bg-blue-100 text-blue-700" :
          booking.status === "CANCELLED" ? "bg-red-100 text-red-600" :
          "bg-slate-100 text-slate-600"
        }`}>
          {booking.status === "DRAFT"     ? "Borrador" :
           booking.status === "SUBMITTED" ? "En revisión" :
           booking.status === "PARTIAL"   ? "Confirmación parcial" :
           booking.status === "CONFIRMED" ? "Confirmado" :
           "Cancelado"}
        </span>

        {isDraft && booking.passengerSlots.length > 0 && (
          <SubmitBookingButton bookingId={bookingId} />
        )}
      </div>

      {/* Add slot panel (only in DRAFT) */}
      {isDraft && available > 0 && (
        <AddSlotPanel bookingId={bookingId} />
      )}

      {/* Slot list */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base">
          Pasajeros ({booking.passengerSlots.length})
        </h2>

        {booking.passengerSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Todavía no agregaste pasajeros. Usá el formulario de arriba para agregar.
          </p>
        ) : (
          <ul className="space-y-2">
            {booking.passengerSlots.map((slot) => {
              const cfg  = SLOT_STATUS[slot.status] ?? SLOT_STATUS_DEFAULT;
              const Icon = cfg.icon;
              return (
                <li
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {/* usuarioId is the only thing we have here without join */}
                      Pasajero asignado
                    </p>
                    <p className="text-xs text-muted-foreground">{slot.representedCompany}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium shrink-0 ${cfg.color}`}>
                    <Icon className="size-3.5" />
                    {cfg.label}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isDraft && booking.passengerSlots.length === 0 && (
        <p className="text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          Agregá al menos un pasajero antes de enviar la reserva a UABL.
        </p>
      )}
    </main>
  );
}
