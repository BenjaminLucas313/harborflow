import { redirect } from "next/navigation";
import Link from "next/link";
import { Ship, ClipboardList, Plus, Send } from "lucide-react";
import { auth } from "@/lib/auth";
import { listGroupBookingsByEmployer } from "@/modules/group-bookings/service";

export default async function EmpresaDashboard() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.employerId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-medium">Tu cuenta no está asociada a ningún empleador.</p>
          <p className="mt-1 text-sm">Contactá al administrador para que configure tu empleador.</p>
        </div>
      </main>
    );
  }

  const bookings = await listGroupBookingsByEmployer(
    session.user.companyId,
    session.user.employerId,
  );

  const pending   = bookings.filter((b) => b.status === "SUBMITTED" || b.status === "PARTIAL").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioná las reservas grupales de tu empresa.
          </p>
        </div>
        <Link
          href="/empresa/reservas/nueva"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nueva reserva
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">En revisión</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{pending}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Confirmadas</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{confirmed}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Secciones" className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/empresa/viajes"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <Ship className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Viajes disponibles</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Explorá los viajes programados y creá una nueva reserva grupal.
          </p>
        </Link>

        <Link
          href="/empresa/reservas"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <ClipboardList className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Mis reservas</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seguí el estado de las reservas grupales de tu empresa.
          </p>
        </Link>

        <Link
          href="/empresa/solicitudes"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <Send className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Solicitudes de lancha</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pedí una embarcación bajo demanda para traslados específicos.
          </p>
        </Link>
      </nav>
    </main>
  );
}
