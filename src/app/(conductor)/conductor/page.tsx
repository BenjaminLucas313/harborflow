import { redirect }  from "next/navigation";
import Link           from "next/link";
import { auth }       from "@/lib/auth";
import { prisma }     from "@/lib/prisma";
import { SlotStatus } from "@prisma/client";
import { Anchor, CalendarClock, ClipboardList, Clock, Users } from "lucide-react";
import { InstallBanner } from "@/components/conductor/install-banner";

const ARG_TZ = "America/Argentina/Buenos_Aires";

const ACTIVE_SLOT_STATUSES: SlotStatus[] = ["PENDING", "CONFIRMED"];

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  BOARDING:  "Embarcando",
  DELAYED:   "Demorado",
  CANCELLED: "Cancelado",
  DEPARTED:  "Partido",
  COMPLETED: "Completado",
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  BOARDING:  "bg-amber-100 text-amber-700",
  DELAYED:   "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-600",
  DEPARTED:  "bg-slate-100 text-slate-600",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

function fmtDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    timeZone: ARG_TZ,
    weekday:  "long",
    day:      "numeric",
    month:    "long",
  });
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    timeZone: ARG_TZ,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
}

function fmtCompact(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone: ARG_TZ,
    weekday:  "short",
    day:      "numeric",
    month:    "short",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
}

export default async function ConductorPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Find the Driver profile linked to this user account.
  const driver = await prisma.driver.findFirst({
    where:  { userId: session.user.id, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  // No linked driver profile — show a clear onboarding message.
  if (!driver) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
          <Anchor className="mx-auto size-8 text-amber-500" aria-hidden="true" />
          <h1 className="font-semibold text-amber-900">Perfil no vinculado</h1>
          <p className="text-sm text-amber-800">
            Tu cuenta no está vinculada a un perfil de conductor.
            Contactá al administrador de la empresa para que realice la vinculación.
          </p>
        </div>
      </main>
    );
  }

  const now = new Date();

  const [upcoming, past] = await Promise.all([
    prisma.trip.findMany({
      where: { driverId: driver.id, departureTime: { gte: now } },
      select: {
        id:            true,
        departureTime: true,
        status:        true,
        capacity:      true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        _count: {
          select: { passengerSlots: { where: { status: { in: ACTIVE_SLOT_STATUSES } } } },
        },
      },
      orderBy: { departureTime: "asc" },
      take:    6,
    }),
    prisma.trip.findMany({
      where: { driverId: driver.id, departureTime: { lt: now } },
      select: {
        id:            true,
        departureTime: true,
        status:        true,
        capacity:      true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        _count: {
          select: { passengerSlots: { where: { status: { in: ACTIVE_SLOT_STATUSES } } } },
        },
      },
      orderBy: { departureTime: "desc" },
      take:    10,
    }),
  ]);

  const nextTrip      = upcoming[0] ?? null;
  const otherUpcoming = upcoming.slice(1);

  return (
    <main className="mx-auto max-w-[480px] px-4 py-6 space-y-6">

      {/* ── PWA install prompt — only rendered when browser fires beforeinstallprompt ── */}
      <InstallBanner />

      {/* ── Próximo viaje ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Próximo viaje
        </h2>

        {nextTrip ? (
          <div className="rounded-2xl border-2 border-primary/20 bg-card p-5 space-y-4">
            {/* Status badge */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {fmtTime(new Date(nextTrip.departureTime))}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {fmtDate(new Date(nextTrip.departureTime))}
                </p>
              </div>
              <span
                className={`mt-0.5 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[nextTrip.status] ?? "bg-slate-100 text-slate-600"}`}
              >
                {STATUS_LABEL[nextTrip.status] ?? nextTrip.status}
              </span>
            </div>

            {/* Trip details */}
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">Lancha</dt>
                <dd className="mt-0.5 font-medium text-sm">{nextTrip.boat.name}</dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">Puerto</dt>
                <dd className="mt-0.5 font-medium text-sm">{nextTrip.branch.name}</dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 col-span-2">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3" aria-hidden="true" />
                  Pasajeros confirmados
                </dt>
                <dd className="mt-0.5 font-bold text-lg tabular-nums">
                  {nextTrip._count.passengerSlots}
                  <span className="text-sm font-normal text-muted-foreground"> / {nextTrip.capacity}</span>
                </dd>
              </div>
            </dl>

            <Link
              href={`/conductor/viajes/${nextTrip.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              <ClipboardList className="size-4" aria-hidden="true" />
              Ver checklist
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            No tenés viajes próximos asignados.
          </div>
        )}
      </section>

      {/* ── Próximos viajes ───────────────────────────────────────────── */}
      {otherUpcoming.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />
            Próximos viajes
          </h2>

          <ul className="space-y-2">
            {otherUpcoming.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/conductor/viajes/${t.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t.boat.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {fmtCompact(new Date(t.departureTime))} · {t.branch.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {t._count.passengerSlots}/{t.capacity}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Historial ─────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Historial
          </h2>

          <ul className="space-y-2">
            {past.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/conductor/viajes/${t.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 opacity-70 hover:opacity-90 transition-opacity"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{t.boat.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {fmtCompact(new Date(t.departureTime))} · {t.branch.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t._count.passengerSlots}/{t.capacity}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No hay viajes registrados aún.
        </div>
      )}
    </main>
  );
}
