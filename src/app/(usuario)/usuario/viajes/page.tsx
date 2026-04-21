import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listSlotsByUsuario } from "@/modules/passenger-slots/service";
import { prisma } from "@/lib/prisma";
import { CheckCircle2, Clock, XCircle, Ship } from "lucide-react";

const STATUS_CONFIG = {
  PENDING: {
    label:  "Pendiente de confirmación",
    icon:   Clock,
    color:  "text-amber-600",
    bg:     "bg-amber-50 border-amber-200",
  },
  CONFIRMED: {
    label:  "Confirmado",
    icon:   CheckCircle2,
    color:  "text-emerald-600",
    bg:     "bg-emerald-50 border-emerald-200",
  },
  REJECTED: {
    label:  "Rechazado",
    icon:   XCircle,
    color:  "text-red-600",
    bg:     "bg-red-50 border-red-200",
  },
  CANCELLED: {
    label:  "Cancelado",
    icon:   XCircle,
    color:  "text-slate-500",
    bg:     "bg-slate-50 border-slate-200",
  },
} as const;

export default async function MisViajes() {
  const session = await auth();
  if (!session) redirect("/login");

  const slots = await listSlotsByUsuario(session.user.companyId, session.user.id);

  // Fetch trip details for all unique tripIds.
  const tripIds = [...new Set(slots.map((s) => s.tripId))];
  const trips = await prisma.trip.findMany({
    where:  { id: { in: tripIds } },
    select: {
      id:            true,
      departureTime: true,
      estimatedArrivalTime: true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
    },
  });
  const tripMap = new Map(trips.map((t) => [t.id, t]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis viajes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Viajes a los que fuiste asignado por tu empresa.
        </p>
      </div>

      {slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Ship className="size-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Todavía no fuiste asignado a ningún viaje.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {slots.map((slot) => {
            const trip    = tripMap.get(slot.tripId);
            const cfg     = STATUS_CONFIG[slot.status as keyof typeof STATUS_CONFIG];
            const Icon    = cfg?.icon ?? Clock;
            const departure = trip?.departureTime
              ? new Date(trip.departureTime).toLocaleString("es-AR", {
                  timeZone:  "America/Argentina/Buenos_Aires",
                  weekday:   "long",
                  day:       "numeric",
                  month:     "long",
                  year:      "numeric",
                  hour:      "2-digit",
                  minute:    "2-digit",
                })
              : "—";

            return (
              <li
                key={slot.id}
                className={`rounded-2xl border p-5 space-y-3 ${cfg?.bg ?? ""}`}
              >
                {/* Status badge */}
                <div className={`flex items-center gap-1.5 text-sm font-medium ${cfg?.color ?? ""}`}>
                  <Icon className="size-4" aria-hidden="true" />
                  {cfg?.label ?? slot.status}
                </div>

                {/* Trip details */}
                <div className="space-y-1">
                  <p className="font-semibold text-base">
                    {trip?.boat.name ?? "Embarcación"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Salida:</span> {departure}
                  </p>
                  {trip?.branch && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Puerto:</span> {trip.branch.name}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Tipo de trabajo:</span>{" "}
                    {slot.workType.name} ({slot.workType.code})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Empresa que representa:</span>{" "}
                    {slot.representedCompany}
                  </p>
                </div>

                {/* Rejection note */}
                {slot.status === "REJECTED" && slot.rejectionNote && (
                  <div className="rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-sm text-red-700">
                    <span className="font-medium">Motivo del rechazo:</span>{" "}
                    {slot.rejectionNote}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
