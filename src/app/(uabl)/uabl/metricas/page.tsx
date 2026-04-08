import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBranchMetrics } from "@/modules/metrics/service";
import { prisma } from "@/lib/prisma";

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId } = session.user;
  const sp = await searchParams;

  // Default: current branch and last 30 days.
  const branches = await prisma.branch.findMany({
    where:   { companyId, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedBranchId = sp.branchId ?? branches[0]?.id;
  const dateTo   = sp.dateTo   ? new Date(sp.dateTo)   : new Date();
  const dateFrom = sp.dateFrom ? new Date(sp.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const metrics = selectedBranchId
    ? await getBranchMetrics(companyId, selectedBranchId, dateFrom, dateTo)
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Métricas UABL</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Distribución de lugares por departamento — base para asignación de costos.
        </p>
      </div>

      {/* Filters (client-side form — simplest approach) */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="branchId" className="text-xs font-medium text-muted-foreground">Puerto</label>
          <select
            id="branchId"
            name="branchId"
            defaultValue={selectedBranchId}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dateFrom" className="text-xs font-medium text-muted-foreground">Desde</label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom.toISOString().split("T")[0]}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dateTo" className="text-xs font-medium text-muted-foreground">Hasta</label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={dateTo.toISOString().split("T")[0]}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
      </form>

      {/* Metrics table */}
      {metrics.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No hay viajes en el rango seleccionado.
        </div>
      ) : (
        <div className="space-y-6">
          {metrics.map((m) => {
            const departure = new Date(m.departureTime).toLocaleString("es-AR", {
              timeZone: "America/Argentina/Buenos_Aires",
              weekday:  "short",
              day:      "numeric",
              month:    "short",
              hour:     "2-digit",
              minute:   "2-digit",
            });

            return (
              <div key={m.tripId} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Trip header */}
                <div className="px-5 py-3 bg-muted/50 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{m.boatName}</span>
                    <span className="text-sm text-muted-foreground ml-2">{departure}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {m.slotsOccupied} / {m.totalCapacity} lugares
                  </span>
                </div>

                {/* Department breakdown */}
                {m.departmentBreakdown.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-muted-foreground">Sin reservas.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-5 py-2 text-left font-medium">Departamento</th>
                        <th className="px-3 py-2 text-center font-medium">Confirmados</th>
                        <th className="px-3 py-2 text-center font-medium">Pendientes</th>
                        <th className="px-3 py-2 text-center font-medium">Rechazados</th>
                        <th className="px-5 py-2 text-center font-medium">Total activos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.departmentBreakdown.map((d) => (
                        <tr key={d.departmentId} className="border-b border-border/50 last:border-0">
                          <td className="px-5 py-3 font-medium">{d.departmentName}</td>
                          <td className="px-3 py-3 text-center text-emerald-700">{d.confirmed}</td>
                          <td className="px-3 py-3 text-center text-blue-700">{d.pending}</td>
                          <td className="px-3 py-3 text-center text-red-600">{d.rejected}</td>
                          <td className="px-5 py-3 text-center font-semibold">{d.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
