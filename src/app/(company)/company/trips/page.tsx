// Company trip browser — COMPANY_REP selects a trip to create an allocation.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TripStatus } from "@prisma/client";
import Link from "next/link";

const BOOKABLE: TripStatus[] = ["SCHEDULED", "BOARDING", "DELAYED"];

export default async function CompanyTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch all upcoming trips from the provider company.
  // In a multi-provider setup this would be filtered by a relationship,
  // but for V1 we show all active upcoming trips across all providers.
  const trips = await prisma.trip.findMany({
    where: {
      status: { in: BOOKABLE },
      departureTime: { gte: new Date() },
    },
    select: {
      id: true,
      departureTime: true,
      estimatedArrivalTime: true,
      status: true,
      capacity: true,
      boat: { select: { id: true, name: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
      allocations: {
        where: { status: { in: ["SUBMITTED", "PARTIALLY_CONFIRMED", "FULLY_CONFIRMED"] } },
        select: {
          seatRequests: {
            where: { status: { in: ["PENDING", "CONFIRMED"] } },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { departureTime: "asc" },
  });

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        <div className="flex items-center gap-4">
          <Link href="/company" className="text-sm text-gray-500 hover:text-gray-700">
            ← Panel
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Viajes disponibles</h1>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">No hay viajes programados en este momento.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => {
              const takenSeats = trip.allocations.reduce(
                (acc, a) => acc + a.seatRequests.length,
                0,
              );
              const availableSeats = trip.capacity - takenSeats;
              const isFull = availableSeats <= 0;

              return (
                <li key={trip.id}>
                  <div className={`rounded-xl border bg-white p-4 ${isFull ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {new Date(trip.departureTime).toLocaleString("es-AR", {
                            dateStyle: "full",
                            timeStyle: "short",
                          })}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-600">
                          {trip.boat.name}
                          {trip.driver &&
                            ` · Capitán: ${trip.driver.firstName} ${trip.driver.lastName}`}
                        </p>
                        <p className="mt-1 text-sm">
                          <span className={isFull ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                            {isFull ? "Sin lugares disponibles" : `${availableSeats} de ${trip.capacity} lugares disponibles`}
                          </span>
                        </p>
                      </div>
                      {!isFull && (
                        <form action={`/api/allocations`} method="POST">
                          {/* Client-side redirect handled by AllocationCreateButton */}
                          <Link
                            href={`/company/trips/${trip.id}/allocate`}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                          >
                            Solicitar lugares
                          </Link>
                        </form>
                      )}
                    </div>
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
