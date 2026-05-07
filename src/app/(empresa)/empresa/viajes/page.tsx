import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Ship, Users } from "lucide-react";
import { ReservarViajeButton } from "@/components/empresa/reservar-viaje-button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function EmpresaViajes() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch upcoming trips open for booking.
  const trips = await prisma.trip.findMany({
    where: {
      companyId: session.user.companyId,
      status:    { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
      departureTime: { gte: new Date() },
    },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      statusReason:  true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
      _count: {
        select: {
          passengerSlots: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { departureTime: "asc" },
    take: 30,
  });

  // Check if port is open.
  const branch = await prisma.branch.findFirst({
    where: { companyId: session.user.companyId, isActive: true },
    select: { id: true },
  });
  const portStatus = branch
    ? await prisma.portStatus.findFirst({
        where:   { branchId: branch.id },
        orderBy: { createdAt: "desc" },
        select:  { status: true, message: true },
      })
    : null;

  const portOpen = !portStatus || portStatus.status === "OPEN";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Viajes disponibles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seleccioná un viaje para crear una nueva reserva grupal.
        </p>
      </div>

      {/* Port closed banner */}
      {!portOpen && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 space-y-1">
          <p className="font-semibold text-red-800">Puerto cerrado</p>
          {portStatus?.message && (
            <p className="text-sm text-red-700">{portStatus.message}</p>
          )}
        </div>
      )}

      {trips.length === 0 ? (
        <EmptyState
          icon={Ship}
          title="No hay viajes disponibles en este momento"
          description="Contactá al proveedor si necesitás un transporte."
        />
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => {
            const occupied    = trip._count.passengerSlots;
            const available   = trip.capacity - occupied;
            const full        = available <= 0;
            const departure   = new Date(trip.departureTime).toLocaleString("es-AR", {
              timeZone: "America/Argentina/Buenos_Aires",
              weekday:  "long",
              day:      "numeric",
              month:    "long",
              year:     "numeric",
              hour:     "2-digit",
              minute:   "2-digit",
            });

            return (
              <li key={trip.id}>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{trip.boat.name}</p>
                      <p className="text-sm text-muted-foreground">{departure}</p>
                      <p className="text-xs text-muted-foreground">{trip.branch.name}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className={`flex items-center gap-1 text-sm font-medium ${full ? "text-red-600" : "text-emerald-600"}`}>
                        <Users className="size-4" />
                        {available} lugar{available !== 1 ? "es" : ""} libre{available !== 1 ? "s" : ""}
                      </div>
                      <p className="text-xs text-muted-foreground">{occupied} / {trip.capacity} ocupados</p>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${full ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, (occupied / trip.capacity) * 100)}%` }}
                    />
                  </div>

                  {!full && portOpen ? (
                    <ReservarViajeButton
                      tripId={trip.id}
                      departureTime={trip.departureTime.toISOString()}
                      availableSeats={available}
                      boatName={trip.boat.name}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {full ? "Sin lugares disponibles." : "Puerto cerrado."}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
