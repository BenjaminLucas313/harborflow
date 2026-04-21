import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, ChevronRight } from "lucide-react";

type StatusCfg = { label: string; color: string };
const STATUS_LABELS_DEFAULT: StatusCfg = { label: "Borrador", color: "bg-slate-100 text-slate-600" };
const STATUS_LABELS: Record<string, StatusCfg> = {
  DRAFT:     { label: "Borrador",   color: "bg-slate-100 text-slate-600" },
  SUBMITTED: { label: "En revisión", color: "bg-blue-100 text-blue-700" },
  PARTIAL:   { label: "Parcial",    color: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Confirmado", color: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Cancelado",  color: "bg-red-100 text-red-600" },
};

export default async function MisReservas() {
  const session = await auth();
  if (!session) redirect("/login");

  if (!session.user.employerId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-medium">Tu cuenta no está asociada a ningún empleador.</p>
        </div>
      </main>
    );
  }

  // Single query: bookings with their trip included for departureTime ordering.
  const bookings = await prisma.groupBooking.findMany({
    where:   { companyId: session.user.companyId, employerId: session.user.employerId },
    include: { trip: { select: { departureTime: true, boat: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  // Separate into upcoming (departureTime > now) and past, capped at 20 for history.
  const proximas = bookings
    .filter((b) => b.trip && b.trip.departureTime > now)
    .sort((a, b) => a.trip!.departureTime.getTime() - b.trip!.departureTime.getTime());

  const historial = bookings
    .filter((b) => !b.trip || b.trip.departureTime <= now)
    .sort((a, b) => (b.trip?.departureTime.getTime() ?? 0) - (a.trip?.departureTime.getTime() ?? 0))
    .slice(0, 20);

  function formatDeparture(d: Date) {
    return d.toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday:  "short",
      day:      "numeric",
      month:    "short",
      hour:     "2-digit",
      minute:   "2-digit",
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis reservas grupales</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas las reservas de tu empresa.
          </p>
        </div>
        <Link
          href="/empresa/reservas/nueva"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="size-4" />
          Nueva
        </Link>
      </div>

      {/* Próximas reservas */}
      {proximas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Próximas ({proximas.length})
          </h2>
          <ul className="space-y-3">
            {proximas.map((booking) => {
              const cfg       = STATUS_LABELS[booking.status] ?? STATUS_LABELS_DEFAULT;
              const departure = booking.trip ? formatDeparture(booking.trip.departureTime) : "—";
              return (
                <li key={booking.id}>
                  <Link
                    href={`/empresa/reservas/${booking.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold truncate">{booking.trip?.boat.name ?? "Viaje"}</p>
                      <p className="text-sm text-muted-foreground">{departure}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {proximas.length === 0 && historial.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Todavía no creaste ninguna reserva.
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historial (últimas {historial.length})
          </h2>
          <ul className="space-y-3">
            {historial.map((booking) => {
              const departure = booking.trip ? formatDeparture(booking.trip.departureTime) : "—";
              return (
                <li key={booking.id}>
                  <Link
                    href={`/empresa/reservas/${booking.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/30 p-5 opacity-70 hover:opacity-90 transition-opacity"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold truncate text-muted-foreground">
                        {booking.trip?.boat.name ?? "Viaje"}
                      </p>
                      <p className="text-sm text-muted-foreground">{departure}</p>
                      <p className="text-xs text-muted-foreground/70">Este viaje ya pasó</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                        Viaje finalizado
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground/50" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
