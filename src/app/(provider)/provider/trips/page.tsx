// Provider schedule management — list and create trips.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Programado",  className: "bg-blue-100 text-blue-700" },
  BOARDING:  { label: "Embarcando",  className: "bg-amber-100 text-amber-700" },
  DELAYED:   { label: "Demorado",    className: "bg-orange-100 text-orange-700" },
  CANCELLED: { label: "Cancelado",   className: "bg-red-100 text-red-700" },
  DEPARTED:  { label: "Partido",     className: "bg-gray-100 text-gray-500" },
  COMPLETED: { label: "Completado",  className: "bg-emerald-100 text-emerald-700" },
};

export default async function ProviderTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const trips = await prisma.trip.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      departureTime: true,
      status: true,
      capacity: true,
      statusReason: true,
      boat: { select: { name: true } },
      driver: { select: { firstName: true, lastName: true } },
      allocations: {
        select: {
          seatRequests: {
            where: { status: { in: ["PENDING", "CONFIRMED"] } },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { departureTime: "desc" },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/provider" className="text-sm text-gray-500 hover:text-gray-700">
              ← Panel
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">No hay viajes registrados.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => {
              const statusInfo = STATUS_LABELS[trip.status] ?? STATUS_LABELS.SCHEDULED!;
              const takenSeats = trip.allocations.reduce(
                (acc, a) => acc + a.seatRequests.length,
                0,
              );
              return (
                <li key={trip.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {new Date(trip.departureTime).toLocaleString("es-AR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        {trip.boat.name}
                        {trip.driver &&
                          ` · ${trip.driver.firstName} ${trip.driver.lastName}`}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {takenSeats} / {trip.capacity} lugares solicitados
                      </p>
                      {trip.statusReason && (
                        <p className="mt-0.5 text-xs text-amber-700">{trip.statusReason}</p>
                      )}
                    </div>
                    <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      </div>
    </main>
  );
}
