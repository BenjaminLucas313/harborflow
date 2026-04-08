// UABL staff dashboard — pending seat count for their department.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function UablDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const departmentId = session.user.departmentId;

  if (!departmentId) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="font-bold text-amber-900">Sin departamento asignado</h1>
          <p className="mt-1 text-sm text-amber-800">
            Tu cuenta aún no tiene un departamento asignado. Contactá a tu administrador.
          </p>
        </div>
      </main>
    );
  }

  // Fetch pending seats for this department, grouped by trip.
  const pendingSeats = await prisma.seatRequest.findMany({
    where: {
      departmentId,
      status: "PENDING",
    },
    select: {
      id: true,
      allocation: {
        select: {
          tripId: true,
          trip: {
            select: {
              id: true,
              departureTime: true,
              status: true,
              boat: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by tripId.
  const byTrip = new Map<string, { trip: (typeof pendingSeats)[0]["allocation"]["trip"]; count: number }>();
  for (const seat of pendingSeats) {
    const { trip } = seat.allocation;
    const existing = byTrip.get(trip.id);
    if (existing) {
      existing.count++;
    } else {
      byTrip.set(trip.id, { trip, count: 1 });
    }
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { name: true },
  });

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel UABL</h1>
          <p className="mt-1 text-sm text-gray-500">
            Departamento: <strong>{department?.name}</strong>
          </p>
        </div>

        {/* Pending count banner */}
        <div className={`rounded-xl border p-5 ${pendingSeats.length > 0 ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
          <p className={`text-4xl font-bold ${pendingSeats.length > 0 ? "text-blue-700" : "text-gray-900"}`}>
            {pendingSeats.length}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            asiento{pendingSeats.length !== 1 ? "s" : ""} pendiente{pendingSeats.length !== 1 ? "s" : ""} de confirmación
          </p>
        </div>

        {/* Trips with pending seats */}
        {byTrip.size > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Viajes con asientos para confirmar
            </h2>
            <ul className="space-y-3">
              {Array.from(byTrip.values()).map(({ trip, count }) => (
                <li key={trip.id}>
                  <Link
                    href={`/uabl/trips/${trip.id}`}
                    className="flex items-center justify-between rounded-xl border bg-white p-4 hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(trip.departureTime).toLocaleString("es-AR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {" — "}
                        {trip.boat.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                        {count} pendiente{count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-gray-400">→</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex gap-3">
          <Link
            href="/uabl/trips"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver todos los viajes
          </Link>
          <Link
            href="/uabl/metrics"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Métricas
          </Link>
        </div>

      </div>
    </main>
  );
}
