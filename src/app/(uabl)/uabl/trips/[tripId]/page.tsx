// UABL seat map — visual display of all seats for a trip.
// Blue = PENDING (actionable by this department), Green = CONFIRMED, Red = REJECTED.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SeatCard } from "@/components/uabl/seat-card";

export default async function UablTripSeatMap({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tripId } = await params;
  const departmentId = session.user.departmentId;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      departureTime: true,
      estimatedArrivalTime: true,
      status: true,
      capacity: true,
      boat: { select: { name: true, capacity: true } },
      driver: { select: { firstName: true, lastName: true } },
      allocations: {
        select: {
          id: true,
          companyId: true,
          status: true,
          company: { select: { name: true } },
          seatRequests: {
            where: { status: { not: "CANCELLED" } },
            select: {
              id: true,
              employeeId: true,
              status: true,
              departmentId: true,
              rejectionNote: true,
              employee: { select: { firstName: true, lastName: true } },
              workType: { select: { name: true } },
              department: { select: { id: true, name: true } },
              confirmedBy: { select: { firstName: true, lastName: true } },
              confirmedAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!trip) {
    return (
      <main className="p-8">
        <p className="text-gray-600">Viaje no encontrado.</p>
      </main>
    );
  }

  // All active seat requests across all allocations.
  const allSeats = trip.allocations.flatMap((a) =>
    a.seatRequests.map((s) => ({
      ...s,
      companyName: a.company.name,
      allocationId: a.id,
    })),
  );

  const pendingCount   = allSeats.filter((s) => s.status === "PENDING").length;
  const confirmedCount = allSeats.filter((s) => s.status === "CONFIRMED").length;
  const rejectedCount  = allSeats.filter((s) => s.status === "REJECTED").length;
  const emptySeats     = trip.capacity - allSeats.length;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/uabl" className="text-sm text-gray-500 hover:text-gray-700">
            ← Panel
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Mapa de asientos</h1>
        </div>

        {/* Trip info */}
        <div className="rounded-xl border bg-white p-5">
          <p className="text-lg font-semibold text-gray-900">
            {new Date(trip.departureTime).toLocaleString("es-AR", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {trip.boat.name} · Capacidad: {trip.capacity}
            {trip.driver && ` · Capitán: ${trip.driver.firstName} ${trip.driver.lastName}`}
          </p>
          {/* Seat count summary */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-blue-400" />
              {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-emerald-400" />
              {confirmedCount} confirmado{confirmedCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-400" />
              {rejectedCount} rechazado{rejectedCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-gray-200" />
              {emptySeats} libre{emptySeats !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Seat grid */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Asientos ocupados
          </h2>
          {allSeats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-gray-500">Sin asientos solicitados en este viaje.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allSeats.map((seat) => (
                <SeatCard
                  key={seat.id}
                  seat={seat}
                  canAct={seat.departmentId === departmentId && seat.status === "PENDING"}
                />
              ))}
              {/* Empty seats */}
              {Array.from({ length: Math.max(0, emptySeats) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center"
                >
                  <p className="text-xs text-gray-400">Libre</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
