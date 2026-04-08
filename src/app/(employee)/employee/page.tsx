// Employee dashboard — shows assigned trips (PENDING + CONFIRMED seats).
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listSeatRequestsByEmployee } from "@/modules/allocations/service";
import { countUnreadNotifications } from "@/modules/notifications/service";
import { Badge } from "@/components/ui/badge";

export default async function EmployeeDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const [seats, unreadCount] = await Promise.all([
    listSeatRequestsByEmployee(session.user.id),
    countUnreadNotifications(session.user.id),
  ]);

  const confirmed = seats.filter((s) => s.status === "CONFIRMED");
  const pending   = seats.filter((s) => s.status === "PENDING");

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bienvenido, {session.user.firstName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Tus viajes asignados aparecen abajo.
            </p>
          </div>
          {unreadCount > 0 && (
            <a
              href="/employee/notifications"
              className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700"
            >
              🔔 {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
            </a>
          )}
        </div>

        {/* Confirmed seats */}
        {confirmed.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Viajes confirmados
            </h2>
            <ul className="space-y-3">
              {confirmed.map((seat) => {
                const trip = (seat as any).allocation?.trip;
                return (
                  <li key={seat.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {trip
                            ? new Date(trip.departureTime).toLocaleString("es-AR", {
                                dateStyle: "full",
                                timeStyle: "short",
                              })
                            : "—"}
                        </p>
                        {trip?.boat && (
                          <p className="mt-0.5 text-sm text-gray-600">
                            Embarcación: {trip.boat.name}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm text-gray-600">
                          Tipo de trabajo: {seat.workType.name}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          Departamento: {seat.department.name}
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 shrink-0">
                        Confirmado
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Pending seats */}
        {pending.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Pendiente de confirmación UABL
            </h2>
            <ul className="space-y-3">
              {pending.map((seat) => {
                const trip = (seat as any).allocation?.trip;
                return (
                  <li key={seat.id} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {trip
                            ? new Date(trip.departureTime).toLocaleString("es-AR", {
                                dateStyle: "full",
                                timeStyle: "short",
                              })
                            : "—"}
                        </p>
                        {trip?.boat && (
                          <p className="mt-0.5 text-sm text-gray-600">
                            Embarcación: {trip.boat.name}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm text-gray-600">
                          Tipo de trabajo: {seat.workType.name}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 shrink-0">
                        Pendiente
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {seats.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-lg font-medium text-gray-700">
              No tenés viajes asignados
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Cuando tu empresa te asigne a un viaje, aparecerá aquí.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
