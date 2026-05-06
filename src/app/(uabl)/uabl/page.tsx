import { redirect } from "next/navigation";
import Link from "next/link";
import { Anchor, Ship, BarChart3, Settings, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AlertasAnomalias } from "@/components/uabl/AlertasAnomalias";
import { DashboardScrollContainer } from "@/components/uabl/DashboardScrollContainer";
import { KanbanViajes } from "@/components/uabl/KanbanViajes";

export default async function UablDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName, companyId, departmentId, isUablAdmin } = session.user;

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
    <DashboardScrollContainer
      screen1={
        <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Bienvenido, {firstName}
            </h1>
            {department && (
              <p className="mt-1 text-sm text-muted-foreground">
                Departamento:{" "}
                <span className="font-medium text-foreground">{department.name}</span>
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
            {/* ── UABL Assistant — CTA destacado ── */}
            <Link
              href="/uabl/assistant"
              className="col-span-full group flex items-center justify-between rounded-2xl p-5 sm:p-6 shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.005]"
              style={{
                background: "linear-gradient(135deg, #0a1628 0%, #0d1b35 55%, #12243d 100%)",
                border:     "1px solid rgba(96,165,250,0.2)",
              }}
              aria-label="Abrir UABL Assistant"
            >
              <div className="flex items-center gap-4">
                <div
                  className="shrink-0 rounded-xl p-3"
                  style={{ background: "rgba(37,99,189,0.2)", border: "1px solid rgba(96,165,250,0.2)" }}
                >
                  <Anchor className="size-6" style={{ color: "#60a5fa" }} aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-bold text-base" style={{ color: "#f0f6ff" }}>
                      UABL Assistant
                    </h2>
                    <span
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: "#34d399" }}
                    >
                      <span
                        style={{
                          width:           6,
                          height:          6,
                          borderRadius:    "50%",
                          backgroundColor: "#34d399",
                          display:         "inline-block",
                        }}
                        aria-hidden="true"
                      />
                      En línea
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "#4d72a8" }}>
                    Consultá datos en tiempo real · Recomendaciones de eficiencia con IA
                  </p>
                </div>
              </div>
              <ChevronRight
                className="size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: "#4d72a8" }}
                aria-hidden="true"
              />
            </Link>

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

          <AlertasAnomalias />
        </main>
      }
      screen2={<KanbanViajes />}
    />
  );
}
