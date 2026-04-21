import { redirect } from "next/navigation";
import Link from "next/link";
import { Ship, ClipboardList, Plus, Send } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const now     = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Card 1: total PENDING PassengerSlots across all active bookings for this employer.
  const pendingPassengers = await prisma.passengerSlot.count({
    where: {
      companyId: session.user.companyId,
      status:    "PENDING",
      groupBooking: {
        employerId: session.user.employerId,
        status:     { in: ["SUBMITTED", "PARTIAL"] },
      },
    },
  });

  // Card 2: CONFIRMED bookings whose trip departs within the next 7 days.
  const viajesEstaSemana = await prisma.groupBooking.count({
    where: {
      companyId:  session.user.companyId,
      employerId: session.user.employerId,
      status:     "CONFIRMED",
      trip: {
        departureTime: { gte: now, lte: in7Days },
      },
    },
  });

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
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendientes UABL</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{pendingPassengers}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingPassengers === 1
              ? "pasajero esperando aprobación"
              : "pasajeros esperando aprobación"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Viajes esta semana</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{viajesEstaSemana}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {viajesEstaSemana === 1
              ? "viaje confirmado en 7 días"
              : "viajes confirmados en 7 días"}
          </p>
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
