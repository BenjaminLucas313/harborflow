"use client";

// =============================================================================
// UablMetricasDashboard — Integrated UABL metrics dashboard
// =============================================================================
//
// Unified filter bar:
//   Puerto (branch)  Mes  Año  Departamento  Desde  Hasta  [Filtrar] [CSV] [PDF]
//
// When Mes/Año changes, Desde/Hasta are auto-synced to the full calendar month
// (Argentina timezone). The user can override them independently.
//
// Sections rendered:
//   1. KPI summary cards (4)
//   2. Bar chart — seats per department in the period
//   3. Line chart  — daily occupancy %
//   4. Liquidation table — per-dept totals with settlement state
//   5. Efficiency alerts — low-occupancy boats, solo-dept trips, peak hours
//   6. Per-trip breakdown — collapsible, uses branch + date range
//
// All data is fetched client-side via:
//   /api/metricas              → monthly summary (KPIs, charts, liquidation)
//   /api/metricas/eficiencia   → efficiency signals
//   /api/metrics/uabl          → per-trip department breakdown (existing endpoint)
//
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  AlertTriangle, Download, FileText, TrendingDown, Users, Ship,
  Clock, Loader2, ChevronDown, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import type { AdminMetrics, EficienciaMetrics, DeptoResumen } from "@/modules/metrics/admin-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Branch = { id: string; name: string };
type Dept   = { id: string; name: string };

// The existing /api/metrics/uabl returns this shape (departureTime is string in JSON).
type TripRow = {
  tripId:        string;
  departureTime: string;
  boatName:      string;
  totalCapacity: number;
  slotsOccupied: number;
  departmentBreakdown: Array<{
    departmentId:   string;
    departmentName: string;
    confirmed:      number;
    pending:        number;
    rejected:       number;
    cancelled:      number;
    total:          number;
  }>;
};

type Props = {
  branches:        Branch[];
  departments:     Dept[];
  defaultMes:      number;
  defaultAnio:     number;
  defaultBranchId: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD string for the first day of a month (Argentina UTC-3). */
function monthStart(mes: number, anio: number): string {
  // April 1 ART 00:00 = April 1 UTC 03:00 → date part is still April 1.
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

/** YYYY-MM-DD string for the last day of a month. */
function monthEnd(mes: number, anio: number): string {
  // Day 0 of month+1 = last day of month.
  const d = new Date(Date.UTC(anio, mes, 0));   // mes is 1-indexed, so mes+0 = last day of mes-1... wait
  // Date.UTC(anio, mes, 0): month is 0-indexed in Date.UTC, so mes=4 → May, day 0 → April 30 ✓
  return d.toISOString().split("T")[0] ?? `${anio}-${String(mes).padStart(2, "0")}-30`;
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatHora(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function formatDeparture(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday:  "short",
    day:      "numeric",
    month:    "short",
    hour:     "2-digit",
    minute:   "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label, value, sub, color,
}: {
  label:  string;
  value:  string | number;
  sub?:   string;
  color?: "amber" | "red" | "emerald" | "blue";
}) {
  const cls = { amber: "text-amber-600", red: "text-red-600", emerald: "text-emerald-600", blue: "text-blue-600" };
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-1 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-3xl font-bold tabular-nums", cls[color ?? "blue"])}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UablMetricasDashboard({
  branches, departments, defaultMes, defaultAnio, defaultBranchId,
}: Props) {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [mes,      setMesRaw]   = useState(defaultMes);
  const [anio,     setAnioRaw]  = useState(defaultAnio);
  const [deptId,   setDeptId]   = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [dateFrom, setDateFrom] = useState(() => monthStart(defaultMes, defaultAnio));
  const [dateTo,   setDateTo]   = useState(() => monthEnd(defaultMes, defaultAnio));

  // When month/year changes, auto-sync date range pickers.
  const setMes = useCallback((m: number) => {
    setMesRaw(m);
    setDateFrom(monthStart(m, anio));
    setDateTo(monthEnd(m, anio));
  }, [anio]);

  const setAnio = useCallback((a: number) => {
    setAnioRaw(a);
    setDateFrom(monthStart(mes, a));
    setDateTo(monthEnd(mes, a));
  }, [mes]);

  // ── Fetched data ──────────────────────────────────────────────────────────
  const [metrics,      setMetrics]      = useState<AdminMetrics | null>(null);
  const [eficiency,    setEficiency]    = useState<EficienciaMetrics | null>(null);
  const [tripRows,     setTripRows]     = useState<TripRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [tripsOpen,    setTripsOpen]    = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Use a ref to track whether this is the first render (auto-fetch on mount).
  const didMount = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mParams = new URLSearchParams({ mes: String(mes), anio: String(anio) });
      if (deptId) mParams.set("departamentoId", deptId);

      const tParams = new URLSearchParams({ branchId });
      if (dateFrom) tParams.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo)   tParams.set("dateTo",   new Date(dateTo + "T23:59:59").toISOString());

      const [mRes, eRes, tRes] = await Promise.all([
        fetch(`/api/metricas?${mParams}`),
        fetch(`/api/metricas/eficiencia?${new URLSearchParams({ mes: String(mes), anio: String(anio) })}`),
        fetch(`/api/metrics/uabl?${tParams}`),
      ]);

      type MetricaResp  = { data?: AdminMetrics;          error?: { message: string } };
      type EficiResp    = { data?: EficienciaMetrics;     error?: { message: string } };
      type TripResp     = TripRow[] | { error: string };

      const [mJson, eJson, tJson] = await Promise.all([
        mRes.json() as Promise<MetricaResp>,
        eRes.json() as Promise<EficiResp>,
        tRes.json() as Promise<TripResp>,
      ]);

      if (!mRes.ok) throw new Error((mJson as MetricaResp).error?.message ?? "Error al cargar métricas.");
      if (!eRes.ok) throw new Error((eJson as EficiResp).error?.message    ?? "Error al cargar eficiencia.");

      setMetrics(   (mJson as MetricaResp).data  ?? null);
      setEficiency( (eJson as EficiResp).data    ?? null);
      setTripRows(  Array.isArray(tJson) ? tJson : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, [mes, anio, deptId, branchId, dateFrom, dateTo]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      void fetchAll();
    }
  }, [fetchAll]);

  // ── Export ─────────────────────────────────────────────────────────────────
  function handleExportCSV() {
    if (!metrics) return;
    const rows: DeptoResumen[] = metrics.resumenPorDepto;
    exportToCSV(
      rows.map((r) => ({
        Departamento:          r.departamentoNombre,
        Confirmados:           r.asientosConfirmados,
        Pendientes:            r.asientosPendientes,
        "Total Liquidados":    r.totalAsientosLiq.toFixed(4),
        "Viajes Liquidados":   r.viajesLiquidados,
        Liquidado:             r.liquidado ? "Sí" : "No",
      })),
      `metricas-${anio}-${String(mes).padStart(2, "0")}`,
    );
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const barData = metrics?.resumenPorDepto.map((r) => ({
    name:     r.departamentoNombre.length > 14
      ? r.departamentoNombre.slice(0, 14) + "…"
      : r.departamentoNombre,
    asientos: r.asientosConfirmados + r.asientosPendientes,
  })) ?? [];

  const lineData = metrics?.ocupacionPorDia.map((d) => ({
    fecha: d.fecha.slice(5),
    pct:   Math.round(d.ocupacion * 100),
  })) ?? [];

  const selectedBranchName = branches.find((b) => b.id === branchId)?.name ?? branchId;
  const selectedDeptName   = departments.find((d) => d.id === deptId)?.name;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 print:space-y-6">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">

          {/* Puerto (branch) */}
          <div className="space-y-1">
            <label htmlFor="f-branch" className="text-xs font-medium text-muted-foreground">Puerto</label>
            <select
              id="f-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Mes */}
          <div className="space-y-1">
            <label htmlFor="f-mes" className="text-xs font-medium text-muted-foreground">Mes</label>
            <select
              id="f-mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Año */}
          <div className="space-y-1">
            <label htmlFor="f-anio" className="text-xs font-medium text-muted-foreground">Año</label>
            <select
              id="f-anio"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Departamento */}
          <div className="space-y-1">
            <label htmlFor="f-dept" className="text-xs font-medium text-muted-foreground">Departamento</label>
            <select
              id="f-dept"
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Separator */}
          <div className="h-9 w-px bg-border mx-1 self-end hidden sm:block" />

          {/* Desde */}
          <div className="space-y-1">
            <label htmlFor="f-from" className="text-xs font-medium text-muted-foreground">Desde</label>
            <input
              id="f-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Hasta */}
          <div className="space-y-1">
            <label htmlFor="f-to" className="text-xs font-medium text-muted-foreground">Hasta</label>
            <input
              id="f-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Filtrar */}
          <button
            type="button"
            onClick={() => void fetchAll()}
            disabled={loading}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 self-end"
          >
            {loading
              ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              : <RefreshCw className="size-4" aria-hidden="true" />
            }
            Filtrar
          </button>

          {/* Export buttons */}
          <div className="ml-auto flex gap-2 self-end">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!metrics || loading}
              className="flex items-center gap-1.5 h-9 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Download className="size-4" aria-hidden="true" />
              CSV
            </button>
            {metrics && !loading ? (
              <a
                href={`/api/metricas/export/pdf?mes=${mes}&anio=${anio}${deptId ? `&departamentoId=${deptId}` : ""}`}
                download
                className="flex items-center gap-1.5 h-9 rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted transition-colors"
              >
                <FileText className="size-4" aria-hidden="true" />
                PDF
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="flex items-center gap-1.5 h-9 rounded-lg border border-input bg-background px-3 text-sm opacity-40 cursor-not-allowed select-none"
              >
                <FileText className="size-4" aria-hidden="true" />
                PDF
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && !metrics && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">Cargando métricas…</span>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {metrics && (
        <>
          {/* Print header */}
          <div className="hidden print:block text-sm text-muted-foreground">
            {MONTH_NAMES[mes - 1]} {anio}
            {selectedDeptName ? ` · ${selectedDeptName}` : ""}
            {" · "}{selectedBranchName}
          </div>

          {/* ── KPI cards ──────────────────────────────────────────────────── */}
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

          {/* ── Charts row ─────────────────────────────────────────────────── */}
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
                <p className="py-10 text-center text-sm text-muted-foreground">Sin datos para el período.</p>
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
                <p className="py-10 text-center text-sm text-muted-foreground">Sin datos para el período.</p>
              )}
            </div>
          </div>

          {/* ── Liquidation table ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Tabla de liquidación por departamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {MONTH_NAMES[mes - 1]} {anio}
                {selectedDeptName ? ` · ${selectedDeptName}` : ""}
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
                          <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            r.liquidado
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700",
                          )}>
                            {r.liquidado ? "Liquidado" : "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
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

      {/* ── Efficiency alerts ──────────────────────────────────────────────── */}
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
                  Considerá consolidar viajes o reducir capacidad.
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
                    <li key={h.hora} className="flex items-center gap-2 text-sm">
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
                  Priorizar disponibilidad en estos horarios.
                </p>
              )}
            </div>
          </div>

          {eficiency.lanchasBajaOcupacion.length   === 0 &&
           eficiency.deptosSolosFrecuentes.length  === 0 &&
           eficiency.horariosAltaDemanda.length    === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <TrendingDown className="size-5 text-emerald-600 shrink-0" aria-hidden="true" />
              <p className="text-sm text-emerald-700">Sin alertas de eficiencia para este período.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Per-trip breakdown (collapsible) ───────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setTripsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          aria-expanded={tripsOpen}
        >
          <div>
            <h2 className="text-sm font-semibold">Desglose por viaje</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedBranchName} · {dateFrom} → {dateTo}
              {tripRows.length > 0 ? ` · ${tripRows.length} viajes` : ""}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 shrink-0",
              tripsOpen ? "rotate-0" : "-rotate-90",
            )}
            aria-hidden="true"
          />
        </button>

        {/* Animated content */}
        <div className={cn(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out",
          tripsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="overflow-hidden">
            <div className="border-t border-border">
              {tripRows.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                  No hay viajes en el rango seleccionado.
                </p>
              ) : (
                <div className="space-y-4 p-5">
                  {tripRows.map((trip) => (
                    <div key={trip.tripId} className="rounded-xl border border-border overflow-hidden">
                      {/* Trip header */}
                      <div className="px-5 py-3 bg-muted/40 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm">{trip.boatName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatDeparture(trip.departureTime)}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {trip.slotsOccupied} / {trip.totalCapacity} lugares
                        </span>
                      </div>

                      {/* Department breakdown */}
                      {trip.departmentBreakdown.length === 0 ? (
                        <p className="px-5 py-3 text-xs text-muted-foreground">Sin reservas.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground">
                              <th className="px-5 py-2 text-left font-medium">Departamento</th>
                              <th className="px-3 py-2 text-center font-medium">Confirmados</th>
                              <th className="px-3 py-2 text-center font-medium">Pendientes</th>
                              <th className="px-3 py-2 text-center font-medium">Rechazados</th>
                              <th className="px-5 py-2 text-center font-medium">Total activos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trip.departmentBreakdown.map((d) => (
                              <tr key={d.departmentId} className="border-b border-border/50 last:border-0">
                                <td className="px-5 py-2.5 font-medium">{d.departmentName}</td>
                                <td className="px-3 py-2.5 text-center text-emerald-700">{d.confirmed}</td>
                                <td className="px-3 py-2.5 text-center text-blue-700">{d.pending}</td>
                                <td className="px-3 py-2.5 text-center text-red-600">{d.rejected}</td>
                                <td className="px-5 py-2.5 text-center font-semibold">{d.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
