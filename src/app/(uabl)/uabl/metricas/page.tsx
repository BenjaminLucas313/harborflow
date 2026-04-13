// /uabl/metricas — UABL metrics dashboard
//
// Server component:
//   - Auth + UABL role guard
//   - Fetches branches and departments (static selector lists)
//   - Computes Argentina current month/year for default filter state
//   - Renders UablMetricasDashboard (client component — all interactive UI)
//
// All filtering, chart rendering, and API calls are handled client-side.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UablMetricasDashboard } from "@/components/uabl/UablMetricasDashboard";

/** Argentina current month/year (UTC-3, no DST). */
function argNow(): { mes: number; anio: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return {
    mes:  now.getUTCMonth() + 1,
    anio: now.getUTCFullYear(),
  };
}

export default async function MetricasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "UABL") redirect("/uabl");

  const { companyId } = session.user;

  const [branches, departments] = await Promise.all([
    prisma.branch.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { mes, anio } = argNow();
  const defaultBranchId = branches[0]?.id ?? "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Métricas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Distribución de asientos, liquidación por departamento y señales de eficiencia operativa.
        </p>
      </div>

      <UablMetricasDashboard
        branches={branches}
        departments={departments}
        defaultMes={mes}
        defaultAnio={anio}
        defaultBranchId={defaultBranchId}
      />
    </main>
  );
}
