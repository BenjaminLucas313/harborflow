import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripStatusManager } from "@/components/proveedor/trip-status-manager";
import { ConductorSelector } from "@/components/proveedor/conductor-selector";
import type { ConductorOption } from "@/components/proveedor/conductor-selector";
import { TripStopTimeline } from "@/components/trips/trip-stop-timeline";
import { TripHistorial } from "@/components/trips/TripHistorial";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  BOARDING:  "Embarcando",
  DELAYED:   "Demorado",
  CANCELLED: "Cancelado",
  DEPARTED:  "Partido",
  COMPLETED: "Completado",
};
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  BOARDING:  "bg-amber-100 text-amber-700",
  DELAYED:   "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-600",
  DEPARTED:  "bg-slate-100 text-slate-600",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};
const SLOT_STATUS_LABEL: Record<string, string> = {
  PENDING:   "Pendiente",
  CONFIRMED: "Confirmado",
  REJECTED:  "Rechazado",
  CANCELLED: "Cancelado",
};
const SLOT_STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-red-100 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function ProveedorTripDetail({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tripId } = await params;

  const [trip, driversRaw] = await Promise.all([
  prisma.trip.findFirst({
    where:  { id: tripId, companyId: session.user.companyId },
    select: {
      id:                   true,
      status:               true,
      departureTime:        true,
      estimatedArrivalTime: true,
      capacity:             true,
      notes:                true,
      automatizado:         true,
      driverId:             true,
      boat:    { select: { name: true } },
      branch:  { select: { name: true } },
      driver:  { select: { firstName: true, lastName: true } },
      stops:   { select: { order: true, name: true }, orderBy: { order: "asc" as const } },
      passengerSlots: {
        select: {
          id:     true,
          status: true,
          representedCompany: true,
          workType:  { select: { name: true } },
          usuario:   { select: { firstName: true, lastName: true } },
          groupBooking: { select: { employer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  }),
  prisma.driver.findMany({
    where:   { companyId: session.user.companyId, isActive: true },
    select:  { id: true, firstName: true, lastName: true, userId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  }),
  ]);

  if (!trip) notFound();

  const drivers: ConductorOption[] = driversRaw.map((d) => ({
    id:        d.id,
    firstName: d.firstName,
    lastName:  d.lastName,
    hasUser:   d.userId !== null,
  }));

  const dep = new Date(trip.departureTime).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
  });

  const confirmedCount = trip.passengerSlots.filter((s) => s.status === "CONFIRMED").length;
  const pendingCount   = trip.passengerSlots.filter((s) => s.status === "PENDING").length;
  const occupied       = trip.passengerSlots.filter((s) => ["PENDING", "CONFIRMED"].includes(s.status)).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/proveedor/viajes"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Viajes
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{trip.boat.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dep}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium shrink-0 ${STATUS_COLOR[trip.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {STATUS_LABEL[trip.status] ?? trip.status}
          </span>
        </div>

        {/* Trip details grid */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl border bg-card p-3 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Puerto</dt>
            <dd className="text-sm font-medium">{trip.branch.name}</dd>
          </div>
          <div className="rounded-xl border bg-card p-3 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Capacidad</dt>
            <dd className="text-sm font-medium">{occupied}/{trip.capacity} asientos</dd>
          </div>
          {trip.driver && (
            <div className="rounded-xl border bg-card p-3 space-y-0.5">
              <dt className="text-xs text-muted-foreground">Conductor</dt>
              <dd className="text-sm font-medium">{trip.driver.firstName} {trip.driver.lastName}</dd>
            </div>
          )}
          {trip.estimatedArrivalTime && (
            <div className="rounded-xl border bg-card p-3 space-y-0.5">
              <dt className="text-xs text-muted-foreground">Llegada estimada</dt>
              <dd className="text-sm font-medium">
                {new Date(trip.estimatedArrivalTime).toLocaleTimeString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  hour:     "2-digit",
                  minute:   "2-digit",
                })}
              </dd>
            </div>
          )}
          <div className="rounded-xl border bg-card p-3 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Confirmados</dt>
            <dd className="text-sm font-medium text-emerald-700">{confirmedCount}</dd>
          </div>
          <div className="rounded-xl border bg-card p-3 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Pendientes</dt>
            <dd className="text-sm font-medium text-yellow-700">{pendingCount}</dd>
          </div>
        </dl>

        {trip.stops.length > 0 && (
          <div className="mt-4">
            <TripStopTimeline stops={trip.stops} />
          </div>
        )}

        {trip.notes && (
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-3 text-sm text-amber-800">
            <span className="font-medium">Notas: </span>{trip.notes}
          </div>
        )}
      </div>

      {/* Conductor assignment */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm">Conductor asignado</h2>
        <ConductorSelector
          tripId={trip.id}
          currentDriverId={trip.driverId ?? null}
          drivers={drivers}
        />
      </div>

      {/* Status manager */}
      <TripStatusManager tripId={trip.id} currentStatus={trip.status} automatizado={trip.automatizado} />

      {/* Passenger manifest */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base">
          Pasajeros asignados ({trip.passengerSlots.length})
        </h2>

        {trip.passengerSlots.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground border rounded-xl">
            No hay pasajeros asignados a este viaje.
          </div>
        ) : (
          <ul className="space-y-2">
            {trip.passengerSlots.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {slot.usuario.firstName} {slot.usuario.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {slot.workType.name}
                    {slot.groupBooking?.employer?.name && ` · ${slot.groupBooking.employer.name}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${SLOT_STATUS_COLOR[slot.status] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {SLOT_STATUS_LABEL[slot.status] ?? slot.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Audit history */}
      <section aria-labelledby="historial-heading" className="space-y-4">
        <h2 id="historial-heading" className="font-semibold text-base">
          Historial de cambios
        </h2>
        <TripHistorial tripId={tripId} />
      </section>
    </main>
  );
}
