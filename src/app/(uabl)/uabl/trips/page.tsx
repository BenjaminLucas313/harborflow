// UABL trips listing — all upcoming trips with pending seat count for the staff's department.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function UablTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const departmentId = session.user.departmentId;
  if (!departmentId) redirect("/uabl");

  // Fetch upcoming trips with pending seat counts scoped to this department.
  const trips = await prisma.trip.findMany({
    where: {
      departureTime: { gte: new Date() },
      status: { notIn: ["CANCELLED", "COMPLETED", "DEPARTED"] },
    },
    orderBy: { departureTime: "asc" },
    take: 50,
    select: {
      id: true,
      departureTime: true,
      status: true,
      capacity: true,
      boat: { select: { name: true } },
      allocations: {
        select: {
          seatRequests: {
            where: { departmentId },
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: "Programado",
    BOARDING:  "Embarcando",
    DELAYED:   "Demorado",
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        <div className="flex items-center gap-4">
          <Link href="/uabl" className="text-sm text-gray-500 hover:text-gray-700">
            ← Panel
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Viajes</h1>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">No hay viajes próximos.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => {
              const allSeats = trip.allocations.flatMap((a) => a.seatRequests);
              const pending   = allSeats.filter((s) => s.status === "PENDING").length;
              const confirmed = allSeats.filter((s) => s.status === "CONFIRMED").length;

              return (
                <li key={trip.id}>
                  <Link
                    href={`/uabl/trips/${trip.id}`}
                    className="flex items-center justify-between rounded-xl border bg-white p-4 hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {new Date(trip.departureTime).toLocaleString("es-AR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">{trip.boat.name}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {STATUS_LABELS[trip.status] ?? trip.status}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      {pending > 0 && (
                        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
                          {pending} pendiente{pending !== 1 ? "s" : ""}
                        </span>
                      )}
                      {confirmed > 0 && (
                        <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                          {confirmed} confirmado{confirmed !== 1 ? "s" : ""}
                        </span>
                      )}
                      {pending === 0 && confirmed === 0 && (
                        <span className="text-xs text-gray-400">Sin asientos</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

      </div>
    </main>
  );
}
