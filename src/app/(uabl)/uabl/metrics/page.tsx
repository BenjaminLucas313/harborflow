// UABL metrics dashboard — seats per department per trip.
// Used to know how many seats each department used (for external billing with Provider).
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function UablMetricsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const departmentId = session.user.departmentId;

  // Fetch all trips that had at least one confirmed seat from this department.
  const trips = await prisma.trip.findMany({
    where: {
      allocations: {
        some: {
          seatRequests: {
            some: {
              departmentId: departmentId ?? undefined,
              status: { in: ["PENDING", "CONFIRMED", "REJECTED"] },
            },
          },
        },
      },
      departureTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    },
    select: {
      id: true,
      departureTime: true,
      capacity: true,
      boat: { select: { name: true } },
      allocations: {
        select: {
          company: { select: { name: true } },
          seatRequests: {
            where: { departmentId: departmentId ?? undefined },
            select: { id: true, status: true },
          },
        },
      },
    },
    orderBy: { departureTime: "desc" },
  });

  // Aggregate per-trip metrics.
  const rows = trips.map((trip) => {
    const seats = trip.allocations.flatMap((a) => a.seatRequests);
    return {
      tripId: trip.id,
      departureTime: trip.departureTime,
      boatName: trip.boat.name,
      confirmed: seats.filter((s) => s.status === "CONFIRMED").length,
      pending:   seats.filter((s) => s.status === "PENDING").length,
      rejected:  seats.filter((s) => s.status === "REJECTED").length,
      total: seats.length,
    };
  }).filter((r) => r.total > 0);

  const totalConfirmed = rows.reduce((acc, r) => acc + r.confirmed, 0);

  const department = await prisma.department.findUnique({
    where: { id: departmentId ?? "" },
    select: { name: true },
  });

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        <div className="flex items-center gap-4">
          <Link href="/uabl" className="text-sm text-gray-500 hover:text-gray-700">
            ← Panel
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Métricas</h1>
        </div>

        {department && (
          <p className="text-sm text-gray-500">
            Departamento: <strong className="text-gray-800">{department.name}</strong> · Últimos 30 días
          </p>
        )}

        {/* Summary */}
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Total de asientos confirmados</p>
          <p className="mt-1 text-4xl font-bold text-emerald-600">{totalConfirmed}</p>
          <p className="mt-1 text-xs text-gray-400">
            Este número es el que corresponde reportar al Proveedor para la facturación por departamento.
          </p>
        </div>

        {/* Per-trip table */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Detalle por viaje
          </h2>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-gray-500">Sin datos en los últimos 30 días.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha de salida</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Embarcación</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Confirmados</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Pendientes</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Rechazados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.tripId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        <Link href={`/uabl/trips/${row.tripId}`} className="hover:underline text-blue-600">
                          {new Date(row.departureTime).toLocaleString("es-AR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.boatName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{row.confirmed}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{row.pending}</td>
                      <td className="px-4 py-3 text-right text-red-600">{row.rejected}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{totalConfirmed}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      {rows.reduce((acc, r) => acc + r.pending, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {rows.reduce((acc, r) => acc + r.rejected, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
