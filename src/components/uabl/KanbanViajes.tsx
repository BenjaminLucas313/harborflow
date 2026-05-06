"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TripKanban = {
  id:                  string;
  departureTime:       string;
  status:              string;
  viajeStatus:         string;
  salidaConfirmada:    boolean;
  liquidacionCalculada: boolean;
  capacity:            number;
  boat:   { name: string } | null;
  driver: { firstName: string; lastName: string } | null;
  _count: { passengerSlots: number };
};

type ViajesData = {
  programados:       TripKanban[];
  enEmbarque:        TripKanban[];
  partidos:          TripKanban[];
  completados:       TripKanban[];
  totalHoy:          number;
  ocupacionPromedio: number;
  generadoEn:        string;
};

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

type ColKey = keyof Pick<ViajesData, "programados" | "enEmbarque" | "partidos" | "completados">;

const COLUMNS: { key: ColKey; label: string; headerCls: string; countCls: string }[] = [
  {
    key:       "programados",
    label:     "Programados",
    headerCls: "bg-blue-50 text-blue-700 border-blue-200",
    countCls:  "bg-blue-100 text-blue-700",
  },
  {
    key:       "enEmbarque",
    label:     "En embarque",
    headerCls: "bg-amber-50 text-amber-700 border-amber-200",
    countCls:  "bg-amber-100 text-amber-700",
  },
  {
    key:       "partidos",
    label:     "Partidos",
    headerCls: "bg-green-50 text-green-700 border-green-200",
    countCls:  "bg-green-100 text-green-700",
  },
  {
    key:       "completados",
    label:     "Completados",
    headerCls: "bg-gray-100 text-gray-600 border-gray-200",
    countCls:  "bg-gray-200 text-gray-600",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHora(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

function formatFechaHoy(): string {
  const s = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ocupacionColor(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-400";
}

// ---------------------------------------------------------------------------
// TripCard
// ---------------------------------------------------------------------------

function TripCard({ trip }: { trip: TripKanban }) {
  const router      = useRouter();
  const confirmed   = trip._count.passengerSlots;
  const pct         = trip.capacity > 0 ? Math.round((confirmed / trip.capacity) * 100) : 0;
  const isCancelled = trip.status === "CANCELLED" || trip.viajeStatus === "CANCELADO";

  return (
    <article
      onClick={() => router.push(`/uabl/viajes/${trip.id}`)}
      className="rounded-xl border border-border bg-card p-4 space-y-2.5 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
      aria-label={`Viaje ${formatHora(trip.departureTime)}, ${trip.boat?.name ?? "Sin lancha"}`}
    >
      {/* Hour + cancelled badge */}
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`text-base font-semibold tabular-nums ${
            isCancelled ? "line-through text-muted-foreground" : ""
          }`}
        >
          {formatHora(trip.departureTime)}
        </span>
        {isCancelled && (
          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-600">
            Cancelado
          </span>
        )}
      </div>

      {/* Boat name */}
      <p className="truncate text-xs text-muted-foreground">
        {trip.boat?.name ?? "Sin lancha asignada"}
      </p>

      {/* Occupancy */}
      {!isCancelled && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${ocupacionColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {confirmed} / {trip.capacity} pasajeros
          </p>
        </>
      )}

      {/* Driver */}
      <p className="flex items-center gap-1 text-[11px]">
        <span aria-hidden="true">👤</span>
        {trip.driver ? (
          `${trip.driver.firstName} ${trip.driver.lastName}`
        ) : (
          <span className="text-amber-600">Sin conductor asignado</span>
        )}
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Column skeleton
// ---------------------------------------------------------------------------

function ColumnSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-border">
      <div className="h-10 bg-muted/60" />
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const REFRESH_MS = 30 * 1000;

export function KanbanViajes() {
  const [data,       setData]       = useState<ViajesData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res  = await fetch("/api/uabl/viajes-del-dia");
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json() as ViajesData;
      setData(json);
    } catch {
      setError("No se pudieron cargar los viajes. Revisá tu conexión.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(false); }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => { void fetchData(true); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // Scrolls back to the dashboard section using the shared data attribute set
  // by DashboardScrollContainer — avoids prop drilling across the RSC boundary.
  function scrollToDashboard() {
    const container   = document.querySelector("[data-snap-container]");
    const firstScreen = container?.querySelector<HTMLElement>("[data-section='0']");
    firstScreen?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex h-full flex-col gap-5 px-4 py-6 md:px-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-medium">Viajes del día</h2>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full bg-green-500 ${
                  refreshing ? "animate-ping" : "animate-pulse"
                }`}
                aria-hidden="true"
              />
              En vivo
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{formatFechaHoy()}</p>
        </div>

        <button
          onClick={scrollToDashboard}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Volver al dashboard"
        >
          ↑ Volver al dashboard
        </button>
      </div>

      {/* ── Stats row ── */}
      {data && !loading && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{data.totalHoy}</span>{" "}
            viajes hoy
          </span>
          <span className="text-border" aria-hidden="true">·</span>
          <span>
            <span className="font-semibold text-foreground">{data.ocupacionPromedio}%</span>{" "}
            ocupación promedio
          </span>
          {data.generadoEn && (
            <>
              <span className="hidden text-border sm:inline" aria-hidden="true">·</span>
              <span className="hidden text-xs sm:inline">
                Act.{" "}
                {new Intl.DateTimeFormat("es-AR", {
                  hour:     "2-digit",
                  minute:   "2-digit",
                  timeZone: "America/Argentina/Buenos_Aires",
                }).format(new Date(data.generadoEn))}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => { void fetchData(false); }}
            className="text-xs underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Kanban columns ── */}
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? COLUMNS.map((col) => <ColumnSkeleton key={col.key} />)
          : COLUMNS.map((col) => {
              const trips = data?.[col.key] ?? [];
              return (
                <div
                  key={col.key}
                  className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border"
                >
                  {/* Column header */}
                  <div
                    className={`flex shrink-0 items-center justify-between border-b px-4 py-2.5 ${col.headerCls}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {col.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${col.countCls}`}>
                      {trips.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {trips.length === 0 ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">
                        Sin viajes
                      </p>
                    ) : (
                      trips.map((trip) => <TripCard key={trip.id} trip={trip} />)
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
