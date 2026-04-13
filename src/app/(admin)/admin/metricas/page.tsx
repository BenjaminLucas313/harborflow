// =============================================================================
// Admin metrics page — /admin/metricas
// =============================================================================
//
// Server component:
//   - Auth check + ADMIN role guard
//   - Fetches active departments list (for filter dropdown)
//   - Computes default month/year in Argentina timezone
//   - Renders MetricasDashboard (client component with all interactive UI)
//
// =============================================================================

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MetricasDashboard } from "@/components/admin/MetricasDashboard";

/** Argentina current month/year (UTC-3, no DST). */
function argNow(): { mes: number; anio: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return {
    mes:  now.getUTCMonth() + 1,
    anio: now.getUTCFullYear(),
  };
}

export default async function AdminMetricasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { companyId } = session.user;

  const departments = await prisma.department.findMany({
    where:   { companyId, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const { mes, anio } = argNow();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Métricas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen operativo y de liquidación por departamento.
        </p>
      </div>

      {/* Client dashboard — manages filters, fetches API, renders charts */}
      <MetricasDashboard
        departments={departments}
        defaultMes={mes}
        defaultAnio={anio}
      />
    </main>
  );
}
