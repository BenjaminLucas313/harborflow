import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listSlotsByTrip } from "@/modules/passenger-slots/service";
import { SlotReviewCard } from "@/components/uabl/slot-review-card";
import { SeatGrid } from "@/components/trips/seat-grid";

export default async function TripDetail({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tripId } = await params;
  const { companyId, departmentId } = session.user;

  const trip = await prisma.trip.findUnique({
    where:  { id: tripId, companyId },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      viajeStatus:   true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
    },
  });
  if (!trip) notFound();

  // Fetch all slots for the trip (all departments).
  const allSlots = await listSlotsByTrip(companyId, tripId);

  // Department-scoped view for approval actions.
  const slots = departmentId
    ? allSlots.filter((s) => s.departmentId === departmentId)
    : allSlots;

  // Department-scoped counts (for action summary).
  const pending   = slots.filter((s) => s.status === "PENDING").length;
  const confirmed = slots.filter((s) => s.status === "CONFIRMED").length;
  const rejected  = slots.filter((s) => s.status === "REJECTED").length;

  // Global counts across ALL departments (occupancy reference).
  const globalPending   = allSlots.filter((s) => s.status === "PENDING").length;
  const globalConfirmed = allSlots.filter((s) => s.status === "CONFIRMED").length;
  const globalOccupied  = globalPending + globalConfirmed;
  const globalFree      = Math.max(0, trip.capacity - globalOccupied);

  const departure = new Date(trip.departureTime).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
  });

  const isCompleted = trip.viajeStatus === "PASADO";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Trip header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{trip.boat.name}</h1>
          <p className="text-sm text-muted-foreground">{departure} · {trip.branch.name}</p>
        </div>

        {isCompleted && (
          <a
            href={`/api/viajes/${trip.id}/pdf`}
            download
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            aria-label="Descargar ficha de viaje en PDF"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar ficha
          </a>
        )}
      </div>

      {/* Global occupancy — visible to all UABL regardless of department */}
      <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="font-medium text-foreground">Ocupación global del viaje</span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{globalOccupied}</span> / {trip.capacity} asientos ocupados
          </span>
          <span className={globalFree === 0 ? "text-red-600 font-medium" : "text-emerald-700 font-medium"}>
            {globalFree === 0 ? "Sin lugares libres" : `${globalFree} libre${globalFree !== 1 ? "s" : ""}`}
          </span>
        </div>
        <SeatGrid capacity={trip.capacity} confirmed={globalConfirmed} pending={globalPending} />
      </div>

      {/* Department-scoped summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-blue-50 border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{pending}</p>
          <p className="text-xs text-blue-600 mt-0.5">Pendiente{pending !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{confirmed}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Confirmado{confirmed !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border bg-red-50 border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{rejected}</p>
          <p className="text-xs text-red-600 mt-0.5">Rechazado{rejected !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Slot list */}
      {slots.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No hay slots asignados a tu departamento para este viaje.
        </div>
      ) : (
        <ul className="space-y-3">
          {slots.map((slot) => (
            <li key={slot.id}>
              <SlotReviewCard slot={slot} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
