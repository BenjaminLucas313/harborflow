"use client";

// =============================================================================
// MetricasDashboard — Admin metrics page client component
// =============================================================================
//
// Receives the department list from the server (for the filter dropdown).
// Manages filter state (mes/anio/departamento) and fetches from the API.
// Renders:
//   - Filter bar (month/year selector + department selector)
//   - Summary KPI cards
//   - Bar chart: seats per department (recharts)
//   - Line chart: daily occupancy trend (recharts)
//   - Liquidation table by department
//   - Efficiency alerts section
//   - Export buttons (CSV client-side + PDF via window.print)
//
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  AlertTriangle, Download, FileText, TrendingDown, Users, Ship,
  Clock, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import type { AdminMetrics, EficienciaMetrics } from "@/modules/metrics/admin-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Dept = { id: string; name: string };

type Props = {
  departments:  Dept[];
  defaultMes:   number;
  defaultAnio:  number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatHora(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label, value, sub, color,
}: {
  label: string;
  value: string | number;
  sub?:  string;
  color?: "amber" | "red" | "emerald" | "blue";
}) {
  const colorClass = {
    amber:   "text-amber-600",
    red:     "text-red-600",
    emerald: "text-emerald-600",
    blue:    "text-blue-600",
  }[color ?? "blue"];

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-1 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={cn("text-3xl font-bold tabular-nums", colorClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MetricasDashboard({ departments, defaultMes, defaultAnio }: Props) {
  const [mes,       setMes]       = useState(defaultMes);
  const [anio,      setAnio]      = useState(defaultAnio);
  const [deptId,    setDeptId]    = useState("");
  const [metrics,   setMetrics]   = useState<AdminMetrics | null>(null);
  const [eficiency, setEficiency] = useState<EficienciaMetrics | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        mes:  String(mes),
        anio: String(anio),
        ...(deptId ? { departamentoId: deptId } : {}),
      });

      const [mRes, eRes] = await Promise.all([
        fetch(`/api/metricas?${params}`),
        fetch(`/api/metricas/eficiencia?mes=${mes}&anio=${anio}`),
      ]);

      const mJson = await mRes.json() as { data?: AdminMetrics; error?: { message: string } };
      const eJson = await eRes.json() as { data?: EficienciaMetrics; error?: { message: string } };

      if (!mRes.ok) throw new Error(mJson.error?.message ?? "Error al cargar métricas.");
      if (!eRes.ok) throw new Error(eJson.error?.message ?? "Error al cargar eficiencia.");

      setMetrics(mJson.data ?? null);
      setEficiency(eJson.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, [mes, anio, deptId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Export handlers ────────────────────────────────────────────────────────

  function handleExportCSV() {
    if (!metrics) return;
    exportToCSV(
      metrics.resumenPorDepto.map((r) => ({
        Departamento:       r.departamentoNombre,
        Confirmados:        r.asientosConfirmados,
        Pendientes:         r.asientosPendientes,
        "Total Liquidados": r.totalAsientosLiq.toFixed(4),
        "Viajes Liq.":      r.viajesLiquidados,
        Liquidado:          r.liquidado ? "Sí" : "No",
      })),
      `metricas-${anio}-${String(mes).padStart(2, "0")}`,
    );
  }

  function handleExportPDF() {
    window.print();
  }

  // ── Chart data ─────────────────────────────────────────────────────────────

  const barData = metrics?.resumenPorDepto.map((r) => ({
    name:     r.departamentoNombre.length > 12
      ? r.departamentoNombre.slice(0, 12) + "…"
      : r.departamentoNombre,
    asientos: r.asientosConfirmados + r.asientosPendientes,
  })) ?? [];

  const lineData = metrics?.ocupacionPorDia.map((d) => ({
    fecha: d.fecha.slice(5),   // MM-DD
    pct:   Math.round(d.ocupacion * 100),
  })) ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 print:space-y-6">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        {/* Month */}
        <div className="space-y-1">
          <label htmlFor="filter-mes" className="text-xs font-medium text-muted-foreground">
            Mes
          </label>
          <select
            id="filter-mes"
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div className="space-y-1">
          <label htmlFor="filter-anio" className="text-xs font-medium text-muted-foreground">
            Año
          </label>
          <select
            id="filter-anio"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Department */}
        <div className="space-y-1">
          <label htmlFor="filter-dept" className="text-xs font-medium text-muted-foreground">
            Departamento
          </label>
          <select
            id="filter-dept"
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={loading}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Actualizar"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
        </button>

        {/* Spacer + export buttons */}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!metrics || loading}
            className="flex items-center gap-1.5 h-9 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted transition-colors disabled:opacity-40"
          >
            <Download className="size-4" aria-hidden="true" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={!metrics || loading}
            className="flex items-center gap-1.5 h-9 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted transition-colors disabled:opacity-40"
          >
            <FileText className="size-4" aria-hidden="true" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Loading / Error ──────────────────────────────────────────────────── */}
      {loading && !metrics && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">Cargando métricas…</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {metrics && (
        <>
          {/* ── Period title (print-visible) ─────────────────────────────────── */}
          <div className="hidden print:block">
            <p className="text-sm text-muted-foreground">
              {MONTH_NAMES[mes - 1]} {anio}
              {deptId ? ` · ${departments.find((d) => d.id === deptId)?.name ?? ""}` : ""}
            </p>
          </div>

          {/* ── KPI cards ────────────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Viajes del período"
              value={metrics.totalViajesDelPeriodo}
              color="blue"
            />
            <KpiCard
              label="Ocupación promedio"
              value={pct(metrics.promedioOcupacion)}
              color={metrics.promedioOcupacion < 0.5 ? "red" : metrics.promedioOcupacion < 0.7 ? "amber" : "emerald"}
              sub="de capacidad total"
            />
            <KpiCard
              label="Sin liquidar"
              value={metrics.viajesSinLiquidar}
              color={metrics.viajesSinLiquidar > 0 ? "amber" : "emerald"}
              sub="viajes PASADO pendientes"
            />
            <KpiCard
              label="Departamentos activos"
              value={metrics.resumenPorDepto.length}
              color="blue"
              sub="en el período"
            />
          </div>

          {/* ── Charts row ───────────────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bar chart: seats per department */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Asientos por departamento</h2>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v) => [`${Number(v ?? 0)} asientos`, "Total"]}
                    />
                    <Bar dataKey="asientos" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">Sin datos para el período.</p>
              )}
            </div>

            {/* Line chart: daily occupancy */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Ocupación diaria (%)</h2>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={lineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v) => [`${Number(v ?? 0)}%`, "Ocupación"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      stroke="hsl(38 92% 50%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">Sin datos para el período.</p>
              )}
            </div>
          </div>

          {/* ── Liquidation table ────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Tabla de liquidación por departamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {MONTH_NAMES[mes - 1]} {anio}
              </p>
            </div>

            {metrics.resumenPorDepto.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No hay actividad registrada para este período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3 text-left font-medium">Departamento</th>
                      <th className="px-4 py-3 text-right font-medium">Confirmados</th>
                      <th className="px-4 py-3 text-right font-medium">Pendientes</th>
                      <th className="px-4 py-3 text-right font-medium">Total Liq.</th>
                      <th className="px-4 py-3 text-right font-medium">Viajes Liq.</th>
                      <th className="px-4 py-3 text-center font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.resumenPorDepto.map((r) => (
                      <tr key={r.departamentoId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{r.departamentoNombre}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.asientosConfirmados}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600">{r.asientosPendientes}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {r.liquidado ? r.totalAsientosLiq.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.viajesLiquidados}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium",
                              r.liquidado
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700",
                            )}
                          >
                            {r.liquidado ? "Liquidado" : "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold text-sm">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {metrics.resumenPorDepto.reduce((s, r) => s + r.asientosConfirmados, 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                        {metrics.resumenPorDepto.reduce((s, r) => s + r.asientosPendientes, 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {metrics.resumenPorDepto.reduce((s, r) => s + r.totalAsientosLiq, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {metrics.resumenPorDepto.reduce((s, r) => s + r.viajesLiquidados, 0)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Efficiency alerts ────────────────────────────────────────────────── */}
      {eficiency && (
        <div className="space-y-4 print:hidden">
          <h2 className="text-base font-semibold">Alertas de eficiencia</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Low-occupancy boats */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Ship className="size-4 text-red-500" aria-hidden="true" />
                Lanchas con baja ocupación
              </div>
              {eficiency.lanchasBajaOcupacion.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay lanchas con ocupación &lt; 60%.</p>
              ) : (
                <ul className="space-y-2">
                  {eficiency.lanchasBajaOcupacion.map((b) => (
                    <li key={b.boatId} className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{b.boatName}</span>
                      <span className={cn(
                        "tabular-nums font-semibold ml-2 shrink-0",
                        b.promedioOcupacion < 0.4 ? "text-red-600" : "text-amber-600",
                      )}>
                        {pct(b.promedioOcupacion)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {eficiency.lanchasBajaOcupacion.length > 0 && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  Considerá consolidar viajes o reducir capacidad asignada.
                </p>
              )}
            </div>

            {/* Solo departments */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="size-4 text-amber-500" aria-hidden="true" />
                Departamentos que viajan solos
              </div>
              {eficiency.deptosSolosFrecuentes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay patrones de viaje solitario.</p>
              ) : (
                <ul className="space-y-2">
                  {eficiency.deptosSolosFrecuentes.map((d) => (
                    <li key={d.departamentoId} className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{d.departamentoNombre}</span>
                      <span className="tabular-nums text-amber-600 font-semibold ml-2 shrink-0">
                        {d.vecesViajaSolo}x
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {eficiency.deptosSolosFrecuentes.length > 0 && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  Oportunidad de agrupar con otros departamentos.
                </p>
              )}
            </div>

            {/* Peak hours */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4 text-blue-500" aria-hidden="true" />
                Horarios de mayor demanda
              </div>
              {eficiency.horariosAltaDemanda.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin datos suficientes.</p>
              ) : (
                <ol className="space-y-2">
                  {eficiency.horariosAltaDemanda.map((h, i) => (
                    <li key={h.hora} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <span className="font-medium flex-1">{formatHora(h.hora)}</span>
                      <span className="tabular-nums text-blue-600 font-semibold ml-2 shrink-0">
                        {h.totalAsientos} asientos
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {eficiency.horariosAltaDemanda.length > 0 && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  Priorizar disponibilidad de lanchas en estos horarios.
                </p>
              )}
            </div>
          </div>

          {/* No alerts state */}
          {eficiency.lanchasBajaOcupacion.length === 0 &&
           eficiency.deptosSolosFrecuentes.length === 0 &&
           eficiency.horariosAltaDemanda.length === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <TrendingDown className="size-5 text-emerald-600 shrink-0" aria-hidden="true" />
              <p className="text-sm text-emerald-700">
                Sin alertas de eficiencia para este período.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
