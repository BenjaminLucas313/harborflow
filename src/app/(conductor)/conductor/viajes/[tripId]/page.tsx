import { notFound, redirect } from "next/navigation";
import Link                    from "next/link";
import { ArrowLeft }           from "lucide-react";
import { auth }                from "@/lib/auth";
import { prisma }              from "@/lib/prisma";
import { SlotStatus }          from "@prisma/client";
import { ChecklistClient }     from "@/components/conductor/checklist-client";
import type { PassengerRow }   from "@/components/conductor/checklist-client";
import { TripStopTimeline }    from "@/components/trips/trip-stop-timeline";

const ARG_TZ = "America/Argentina/Buenos_Aires";

export default async function ConductorChecklist({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tripId } = await params;

  // Find this conductor's Driver profile.
  const driver = await prisma.driver.findFirst({
    where:  { userId: session.user.id, isActive: true },
    select: { id: true },
  });

  if (!driver) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
          Tu cuenta no está vinculada a un perfil de conductor. Contactá al administrador.
        </div>
      </main>
    );
  }

  // Load trip — scoped to company for multi-tenant safety.
  const trip = await prisma.trip.findFirst({
    where:  { id: tripId, companyId: session.user.companyId },
    select: {
      id:                  true,
      driverId:            true,
      departureTime:       true,
      status:              true,
      capacity:            true,
      salidaConfirmada:    true,
      salidaConfirmadaAt:  true,
      boat:   { select: { name: true } },
      branch: { select: { name: true } },
      stops:  { select: { order: true, name: true }, orderBy: { order: "asc" as const } },
    },
  });

  if (!trip) notFound();

  // Guard: only the assigned conductor may access this checklist.
  if (trip.driverId !== driver.id) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          No estás asignado a este viaje. Solo el conductor asignado puede acceder al checklist.
        </div>
      </main>
    );
  }

  // Load confirmed passengers + their ConductorCheckin state in parallel.
  const [slots, existingCheckins] = await Promise.all([
    prisma.passengerSlot.findMany({
      where: {
        tripId,
        companyId: session.user.companyId,
        status:    SlotStatus.CONFIRMED,
      },
      select: {
        usuarioId:  true,
        usuario:    { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
      orderBy: [
        { department: { name: "asc" } },
        { usuario: { lastName: "asc" } },
      ],
    }),
    prisma.conductorCheckin.findMany({
      where:  { tripId, companyId: session.user.companyId },
      select: { userId: true, presente: true },
    }),
  ]);

  const passengers: PassengerRow[] = slots.map((s) => ({
    userId:     s.usuarioId,
    firstName:  s.usuario.firstName,
    lastName:   s.usuario.lastName,
    department: s.department?.name ?? null,
  }));

  const initialCheckins: Record<string, boolean> = {};
  for (const c of existingCheckins) {
    initialCheckins[c.userId] = c.presente;
  }

  const dep = new Date(trip.departureTime).toLocaleString("es-AR", {
    timeZone: ARG_TZ,
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });

  return (
    <main className="mx-auto max-w-[480px] px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <Link
          href="/conductor"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Inicio
        </Link>

        <h1 className="text-xl font-bold">{trip.boat.name}</h1>
        <p className="text-sm text-muted-foreground capitalize mt-0.5">{dep}</p>
      </div>

      {/* Trip info */}
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Puerto</dt>
          <dd className="mt-0.5 text-sm font-semibold">{trip.branch.name}</dd>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Capacidad</dt>
          <dd className="mt-0.5 text-sm font-semibold">{slots.length} / {trip.capacity}</dd>
        </div>
      </dl>

      {trip.stops.length > 0 && <TripStopTimeline stops={trip.stops} />}

      {/* Interactive checklist */}
      <ChecklistClient
        tripId={tripId}
        passengers={passengers}
        initialCheckins={initialCheckins}
        salidaConfirmada={trip.salidaConfirmada}
        salidaConfirmadaAt={trip.salidaConfirmadaAt?.toISOString() ?? null}
        capacity={trip.capacity}
      />
    </main>
  );
}
