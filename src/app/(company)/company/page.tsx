// Company representative dashboard — shows allocations summary.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAllocationsByCompany } from "@/modules/allocations/service";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT:               { label: "Borrador",             className: "bg-gray-100 text-gray-700" },
  SUBMITTED:           { label: "Enviado a UABL",       className: "bg-blue-100 text-blue-700" },
  PARTIALLY_CONFIRMED: { label: "Parcialmente aprobado", className: "bg-amber-100 text-amber-700" },
  FULLY_CONFIRMED:     { label: "Totalmente aprobado",  className: "bg-emerald-100 text-emerald-700" },
  CANCELLED:           { label: "Cancelado",            className: "bg-red-100 text-red-700" },
};

export default async function CompanyDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const allocations = await listAllocationsByCompany(session.user.companyId);

  const draft     = allocations.filter((a) => a.status === "DRAFT").length;
  const submitted = allocations.filter((a) => a.status === "SUBMITTED").length;
  const confirmed = allocations.filter((a) => a.status === "FULLY_CONFIRMED").length;

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Panel de empresa
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {session.user.firstName} {session.user.lastName}
            </p>
          </div>
          <Link
            href="/company/trips"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Solicitar lugares
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "En borrador", value: draft, color: "text-gray-700" },
            { label: "Enviados a UABL", value: submitted, color: "text-blue-700" },
            { label: "Confirmados", value: confirmed, color: "text-emerald-700" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border bg-white p-4 text-center">
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Allocations list */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Solicitudes recientes
          </h2>
          {allocations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-gray-600">No hay solicitudes todavía.</p>
              <Link href="/company/trips" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                Buscar viajes disponibles →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {allocations.map((a) => {
                const statusInfo = STATUS_LABELS[a.status] ?? STATUS_LABELS.DRAFT!;
                const seatCount = a.seatRequests.length;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/company/allocations/${a.id}`}
                      className="block rounded-xl border bg-white p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(a.trip.departureTime).toLocaleString("es-AR", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {" — "}
                            {a.trip.boat.name}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {seatCount} lugar{seatCount !== 1 ? "es" : ""} solicitado{seatCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </div>
    </main>
  );
}
