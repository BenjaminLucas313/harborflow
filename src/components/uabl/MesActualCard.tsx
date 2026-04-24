"use client";

// MesActualCard — vista en tiempo real del mes en curso.
//
// Muestra KPIs calculados en vivo (sin snapshot), con comparativa vs el mismo
// período del mes anterior. Se auto-refresca cada 5 minutos.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Distribucion = { nombre: string; asientos: number };

type MesActualData = {
  mes:               number;
  anio:              number;
  diaActual:         number;
  diasEnMes:         number;
  viajesRealizados:  number;
  viajesProgramados: number;
  viajesCancelados:  number;
  promedioOcupacion: number;
  totalPasajeros:    number;
  distribucion:      Distribucion[];
  comparativa: {
    viajesRealizados:  number;
    promedioOcupacion: number;
    totalPasajeros:    number;
  };
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DeltaArrow({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return <Minus className="size-3.5 text-muted-foreground" />;
  if (current > prev) return <TrendingUp  className="size-3.5 text-emerald-600" />;
  if (current < prev) return <TrendingDown className="size-3.5 text-red-500" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

type KpiProps = {
  label:    string;
  value:    string | number;
  sub:      string;
  delta?:   React.ReactNode;
};

function Kpi({ label, value, sub, delta }: KpiProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {delta}
      </div>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MesActualCard() {
  const [data,        setData]        = useState<MesActualData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/metricas/mes-actual");
      const json = await res.json() as { data?: MesActualData; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar datos.");
      setData(json.data ?? null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    void fetchData();
    const id = setInterval(() => { void fetchData(); }, FIVE_MINUTES_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const mesLabel  = data ? `${MONTH_NAMES[data.mes - 1]} ${data.anio}` : "—";
  const progreso  = data ? Math.round((data.diaActual / data.diasEnMes) * 100) : 0;
  const maxAsientos = data?.distribucion[0]?.asientos ?? 1;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold">Mes en curso — {mesLabel}</h2>

          {/* Pulsing "En vivo" badge */}
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span
              className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse"
              aria-hidden="true"
            />
            En vivo
          </span>
        </div>

        <button
          type="button"
          onClick={() => { void fetchData(); }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          title="Actualizar datos"
        >
          {loading
            ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            : <RefreshCw className="size-3" aria-hidden="true" />
          }
          Actualizar
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-5">

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading state (first load only) */}
        {loading && !data && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && (
          <>
            {/* ── KPIs 2×2 ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi
                label="Viajes realizados"
                value={data.viajesRealizados}
                sub="este mes"
              />
              <Kpi
                label="Programados"
                value={data.viajesProgramados}
                sub="restantes"
              />
              <Kpi
                label="Ocupación prom."
                value={`${(data.promedioOcupacion * 100).toFixed(1)}%`}
                sub={`vs ${(data.comparativa.promedioOcupacion * 100).toFixed(1)}% mes ant.`}
                delta={
                  <DeltaArrow
                    current={data.promedioOcupacion}
                    prev={data.comparativa.promedioOcupacion}
                  />
                }
              />
              <Kpi
                label="Pasajeros"
                value={data.totalPasajeros}
                sub="transportados"
              />
            </div>

            {/* ── Month progress bar ─────────────────────────────────────── */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progreso del mes</span>
                <span>Día {data.diaActual} de {data.diasEnMes}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>

            {/* ── Top 5 departments ─────────────────────────────────────── */}
            {data.distribucion.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Top departamentos — asientos confirmados
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  {data.distribucion.map((d, i) => {
                    const pct = Math.round((d.asientos / maxAsientos) * 100);
                    return (
                      <div
                        key={d.nombre}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{d.nombre}</p>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/50 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {d.asientos}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin asientos confirmados este mes.
              </p>
            )}
          </>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Datos calculados en tiempo real.
          El snapshot definitivo se genera el 1 de cada mes.
          {lastUpdated && (
            <>
              {" · "}Actualizado a las{" "}
              {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
