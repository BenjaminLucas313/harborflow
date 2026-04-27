import { Suspense }     from "react";
import { redirect }     from "next/navigation";
import Link             from "next/link";
import { auth }         from "@/lib/auth";
import { prisma }       from "@/lib/prisma";
import { TripStatus }   from "@prisma/client";
import { getPageParam, buildPaginationMeta, PAGE_SIZE } from "@/lib/pagination";
import { Pagination }   from "@/components/ui/Pagination";

// Color coding for the seat grid cells.
const SLOT_COLORS = {
  PENDING:   "bg-blue-400",
  CONFIRMED: "bg-emerald-500",
  REJECTED:  "bg-red-400",
  CANCELLED: "bg-slate-200",
} as const;

export default async function UablViajes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const { companyId, departmentId } = session.user;

  const { page: pageProximos, skip: skipProximos } = getPageParam(sp, "pageProximos");
  const { page: pagePasados,  skip: skipPasados  } = getPageParam(sp, "pagePasados");

  const upcomingWhere = {
    companyId,
    status:        { in: ["SCHEDULED", "BOARDING", "DELAYED"] as TripStatus[] },
    departureTime: { gte: new Date() },
  };
  const pastWhere = { companyId, viajeStatus: "PASADO" as const };

  const slotFilter = departmentId ? { departmentId } : {};

  const [trips, tripsTotal, pastTrips, pastTotal] = await Promise.all([
    prisma.trip.findMany({
      where:   upcomingWhere,
      select: {
        id:            true,
        departureTime: true,
        capacity:      true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        passengerSlots: { where: slotFilter, select: { id: true, status: true } },
      },
      orderBy: { departureTime: "asc" },
      skip:    skipProximos,
      take:    PAGE_SIZE,
    }),
    prisma.trip.count({ where: upcomingWhere }),
    prisma.trip.findMany({
      where:   pastWhere,
      select: {
        id:            true,
        departureTime: true,
        capacity:      true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        passengerSlots: { where: slotFilter, select: { id: true, status: true } },
      },
      orderBy: { departureTime: "desc" },
      skip:    skipPasados,
      take:    PAGE_SIZE,
    }),
    prisma.trip.count({ where: pastWhere }),
  ]);

  const metaProximos = buildPaginationMeta(tripsTotal, pageProximos);
  const metaPasados  = buildPaginationMeta(pastTotal,  pagePasados);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      {/* ── Upcoming trips ────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Viajes programados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hacé clic en un viaje para ver y revisar los slots pendientes.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {Object.entries(SLOT_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-sm ${color}`} />
              {status === "PENDING"   && "Pendiente"}
              {status === "CONFIRMED" && "Confirmado"}
              {status === "REJECTED"  && "Rechazado"}
              {status === "CANCELLED" && "Cancelado"}
            </div>
          ))}
        </div>

        {trips.length === 0 && pageProximos === 1 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay viajes programados próximamente.
          </div>
        ) : (
          <ul className="space-y-4">
            {trips.map((trip) => {
              const slots   = trip.passengerSlots;
              const pending = slots.filter((s) => s.status === "PENDING").length;

              const departure = new Date(trip.departureTime).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                weekday:  "short",
                day:      "numeric",
                month:    "short",
                hour:     "2-digit",
                minute:   "2-digit",
              });

              return (
                <li key={trip.id}>
                  <Link
                    href={`/uabl/viajes/${trip.id}`}
                    className="block rounded-2xl border border-border bg-card p-5 hover:shadow-md transition-shadow space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{trip.boat.name}</p>
                        <p className="text-sm text-muted-foreground">{departure} · {trip.branch.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-muted-foreground">
                          {slots.length} / {trip.capacity} slots
                        </p>
                        {pending > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {pending} pendiente{pending > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mini seat grid */}
                    {slots.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {slots.map((s) => (
                          <span
                            key={s.id}
                            className={`size-4 rounded-sm ${SLOT_COLORS[s.status as keyof typeof SLOT_COLORS] ?? "bg-slate-200"}`}
                            title={s.status}
                          />
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Suspense fallback={null}>
          <Pagination
            page={pageProximos}
            totalPages={metaProximos.totalPages}
            total={tripsTotal}
            paramName="pageProximos"
          />
        </Suspense>
      </section>

      {/* ── Completed trips ───────────────────────────────────────────────── */}
      {(pastTrips.length > 0 || pagePasados > 1) && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Viajes completados</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Descargá la ficha de cada viaje realizado.
            </p>
          </div>

          <ul className="space-y-3">
            {pastTrips.map((trip) => {
              const slots     = trip.passengerSlots;
              const confirmed = slots.filter((s) => s.status === "CONFIRMED").length;

              const departure = new Date(trip.departureTime).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                weekday:  "short",
                day:      "numeric",
                month:    "short",
                year:     "numeric",
                hour:     "2-digit",
                minute:   "2-digit",
              });

              return (
                <li
                  key={trip.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4"
                >
                  <div>
                    <p className="font-medium">{trip.boat.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {departure} · {trip.branch.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {confirmed} asiento{confirmed !== 1 ? "s" : ""} confirmado{confirmed !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <a
                    href={`/api/viajes/${trip.id}/pdf`}
                    download
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    aria-label={`Descargar ficha del viaje ${trip.boat.name} del ${departure}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Ficha PDF
                  </a>
                </li>
              );
            })}
          </ul>

          <Suspense fallback={null}>
            <Pagination
              page={pagePasados}
              totalPages={metaPasados.totalPages}
              total={pastTotal}
              paramName="pagePasados"
            />
          </Suspense>
        </section>
      )}
    </main>
  );
}
