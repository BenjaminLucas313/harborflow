import { redirect } from "next/navigation";
import Link from "next/link";
import { Ship, BarChart3, Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UablDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName, companyId, departmentId, isUablAdmin } = session.user;

  // Count pending slots for this UABL user's department.
  const pendingCount = departmentId
    ? await prisma.passengerSlot.count({
        where: { companyId, departmentId, status: "PENDING" },
      })
    : 0;

  const department = departmentId
    ? await prisma.department.findUnique({
        where:  { id: departmentId },
        select: { name: true },
      })
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenido, {firstName}
        </h1>
        {department && (
          <p className="mt-1 text-sm text-muted-foreground">
            Departamento: <span className="font-medium text-foreground">{department.name}</span>
          </p>
        )}
        {!departmentId && !isUablAdmin && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tu cuenta no tiene departamento asignado. Contactá al administrador UABL.
          </div>
        )}
      </div>

      {/* Pending count highlight */}
      {pendingCount > 0 && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-violet-700">Slots pendientes de revisión</p>
            <p className="text-3xl font-bold text-violet-800">{pendingCount}</p>
          </div>
          <Link
            href="/uabl/viajes"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            Revisar ahora
          </Link>
        </div>
      )}

      <nav aria-label="Secciones" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/uabl/viajes"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Ship className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Viajes</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ver solicitudes de empresas y confirmar o rechazar pasajeros.
          </p>
        </Link>

        <Link
          href="/uabl/metricas"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <BarChart3 className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Métricas</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Distribución de lugares por departamento y asignación de costos.
          </p>
        </Link>

        {isUablAdmin && (
          <Link
            href="/uabl/admin"
            className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Settings className="size-5 text-primary" aria-hidden="true" />
              </div>
              <h2 className="font-semibold">Administración</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Gestionar departamentos, tipos de trabajo y empleadores.
            </p>
          </Link>
        )}
      </nav>
    </main>
  );
}
