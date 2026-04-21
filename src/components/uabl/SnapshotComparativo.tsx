"use client";

// SnapshotComparativo — Evolución histórica de métricas mensuales (UABL)
//
// Fetches from GET /api/snapshots and renders:
//   - Selector de período (3 / 6 / 12 meses)
//   - Cards por mes con métricas clave + indicadores de variación
//   - Gráfico de línea: tendencia de ocupación
//   - Gráfico de barras apiladas: asientos ocupados vs vacíos
//   - Tabla comparativa por departamento

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SnapshotData = {
  id:                    string;
  mes:                   number;
  anio:                  number;
  totalViajes:           number;
  totalAsientosOcupados: number;
  totalAsientosVacios:   number;
  promedioOcupacion:     number;   // 0.0–1.0
  distribucionDeptos:    Record<string, number>;
  cancelaciones:         number;
  viajesBajaOcupacion:   number;
  cerrado:               boolean;
  variacionOcupacion?:      number; // % change vs previous period
  variacionViajes?:         number;
  variacionCancelaciones?:  number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function mesCorto(mes: number, anio: number) {
  return `${MESES_CORTO[mes - 1]} ${String(anio).slice(2)}`;
}
function mesLargo(mes: number, anio: number) {
  return `${MESES_LARGO[mes - 1]} ${anio}`;
}

// ---------------------------------------------------------------------------
// Sub-component: variation badge
// ---------------------------------------------------------------------------

/**
 * Shows a coloured arrow + % change.
 * invertido = true when a lower value is better (cancelaciones, vacíos).
 */
function VarBadge({
  value,
  invertido = false,
}: {
  value?: number;
  invertido?: boolean;
}) {
  if (value === undefined || value === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isUp      = value > 0;
  const isBetter  = invertido ? !isUp : isUp;
  const isNeutral = value === 0;

  const color = isNeutral
    ? "text-muted-foreground"
    : isBetter
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500";

  const arrow = isNeutral ? "" : isUp ? "↑" : "↓";

  return (
    <span className={`text-xs font-medium ${color}`} aria-label={`Variación: ${value > 0 ? "+" : ""}${value.toFixed(1)}%`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: monthly metric card
// ---------------------------------------------------------------------------

function MesCard({ s }: { s: SnapshotData }) {
  const ocupPct = (s.promedioOcupacion * 100).toFixed(1);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {mesLargo(s.mes, s.anio)}
        </p>
        {!s.cerrado && (
          <span className="text-xs text-amber-600 border border-amber-300 bg-amber-50 rounded px-1.5 py-0.5">
            en curso
          </span>
        )}
      </div>

      {/* Main metric: occupancy */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{ocupPct}%</span>
          <VarBadge value={s.variacionOcupacion} />
        </div>
        <p className="text-xs text-muted-foreground">ocupación promedio</p>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-border">
        <div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-semibold tabular-nums">{s.totalViajes}</p>
            <VarBadge value={s.variacionViajes} />
          </div>
          <p className="text-xs text-muted-foreground">viajes</p>
        </div>

        <div>
          <p className="text-lg font-semibold tabular-nums">
            {Math.round(s.totalAsientosVacios)}
          </p>
          <p className="text-xs text-muted-foreground">asientos vacíos</p>
        </div>

        <div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-semibold tabular-nums">{s.cancelaciones}</p>
            <VarBadge value={s.variacionCancelaciones} invertido />
          </div>
          <p className="text-xs text-muted-foreground">cancelaciones</p>
        </div>

        <div>
          <p className="text-lg font-semibold tabular-nums">{s.viajesBajaOcupacion}</p>
          <p className="text-xs text-muted-foreground">viajes &lt;40%</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SnapshotComparativo() {
  const [meses,   setMeses]   = useState(6);
  const [data,    setData]    = useState<SnapshotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async (n: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/snapshots?meses=${n}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const body = await res.json() as { data?: SnapshotData[] };
      setData(body.data ?? []);
    } catch {
      setError("No se pudieron cargar los datos históricos. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(meses); }, [meses, fetchData]);

  // Charts expect oldest → newest (API returns newest first)
  const sorted = [...data].reverse();

  const lineData = sorted.map((s) => ({
    mes:      mesCorto(s.mes, s.anio),
    ocupacion: parseFloat((s.promedioOcupacion * 100).toFixed(1)),
  }));

  const barData = sorted.map((s) => ({
    mes:      mesCorto(s.mes, s.anio),
    ocupados: Math.round(s.totalAsientosOcupados),
    vacios:   Math.round(s.totalAsientosVacios),
  }));

  // Collect all unique department names across all snapshots
  const allDeptos = Array.from(
    new Set(data.flatMap((s) => Object.keys(s.distribucionDeptos))),
  ).sort();

  return (
    <section className="space-y-6">
      {/* Section header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Evolución histórica</h2>
          <p className="text-sm text-muted-foreground">
            Comparativa de métricas operativas por período mensual
          </p>
        </div>

        <div
          className="flex gap-1 rounded-lg border border-border p-1 self-start sm:self-auto"
          role="group"
          aria-label="Período a comparar"
        >
          {([3, 6, 12] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMeses(m)}
              aria-pressed={meses === m}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                meses === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <span className="animate-pulse">Cargando datos históricos…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center space-y-1">
          <p className="font-medium text-muted-foreground">Sin snapshots generados</p>
          <p className="text-sm text-muted-foreground">
            Ejecutá{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              npm run snapshot:generar
            </code>{" "}
            para generar el historial del mes anterior.
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data.length > 0 && (
        <div className="space-y-8">
          {/* Monthly cards (newest first — matches intuition: most recent on top) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((s) => (
              <MesCard key={s.id} s={s} />
            ))}
          </div>

          {/* Line chart: occupancy trend */}
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm font-semibold mb-1">Tendencia de ocupación</p>
            <p className="text-xs text-muted-foreground mb-5">
              Promedio de ocupación por mes (0–100%)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={lineData}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, "Ocupación"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="ocupacion"
                  name="Ocupación"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stacked bar chart: occupied vs empty seats */}
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm font-semibold mb-1">Asientos por mes</p>
            <p className="text-xs text-muted-foreground mb-5">
              Comparación de asientos ocupados y vacíos por período
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={barData}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar
                  dataKey="ocupados"
                  name="Ocupados"
                  stackId="seats"
                  fill="#10b981"
                />
                <Bar
                  dataKey="vacios"
                  name="Vacíos"
                  stackId="seats"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Department distribution table */}
          {allDeptos.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-semibold">Distribución por departamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Asientos asignados (PENDING + CONFIRMED) por departamento y período
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">
                        Departamento
                      </th>
                      {sorted.map((s) => (
                        <th
                          key={s.id}
                          className="text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {mesCorto(s.mes, s.anio)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allDeptos.map((dept, i) => (
                      <tr
                        key={dept}
                        className={`border-b border-border last:border-0 ${
                          i % 2 === 0 ? "" : "bg-muted/20"
                        }`}
                      >
                        <td className="px-5 py-2.5 font-medium">{dept}</td>
                        {sorted.map((s) => (
                          <td
                            key={s.id}
                            className="px-4 py-2.5 text-right tabular-nums"
                          >
                            {s.distribucionDeptos[dept] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
