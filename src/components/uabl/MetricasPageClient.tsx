"use client";

// MetricasPageClient — shared filter state and layout wrapper for /uabl/metricas.
//
// Owns the unified filter bar (Puerto · Mes · Año · Departamento · Desde · Hasta)
// and passes controlled filter values + triggerFetch to UablMetricasDashboard.
// SnapshotComparativo is rendered below with its own independent period selector.
// InformeNarrativoCard is rendered last — monthly AI executive report.

import { useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { UablMetricasDashboard }    from "./UablMetricasDashboard";
import { SnapshotComparativo }      from "./SnapshotComparativo";
import { InformeNarrativoCard }     from "./InformeNarrativoCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Branch = { id: string; name: string };
type Dept   = { id: string; name: string };

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

function monthStart(mes: number, anio: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

function monthEnd(mes: number, anio: number): string {
  const d = new Date(Date.UTC(anio, mes, 0));
  return d.toISOString().split("T")[0] ?? `${anio}-${String(mes).padStart(2, "0")}-30`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricasPageClient({
  branches, departments, defaultMes, defaultAnio, defaultBranchId,
}: Props) {
  const [mes,          setMesRaw]       = useState(defaultMes);
  const [anio,         setAnioRaw]      = useState(defaultAnio);
  const [deptId,       setDeptId]       = useState("");
  const [branchId,     setBranchId]     = useState(defaultBranchId);
  const [dateFrom,     setDateFrom]     = useState(() => monthStart(defaultMes, defaultAnio));
  const [dateTo,       setDateTo]       = useState(() => monthEnd(defaultMes, defaultAnio));
  const [triggerFetch, setTriggerFetch] = useState(0);
  const [pending,      setPending]      = useState(false);

  // When month/year changes, auto-sync date range to full calendar month.
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

  function handleFiltrar() {
    setPending(true);
    setTriggerFetch((n) => n + 1);
  }

  return (
    <div className="space-y-8">
      {/* ── Unified filter bar ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">

          {/* Puerto */}
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
            onClick={handleFiltrar}
            disabled={pending}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 self-end"
          >
            {pending
              ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              : <RefreshCw className="size-4" aria-hidden="true" />
            }
            Filtrar
          </button>
        </div>
      </div>

      {/* ── Dashboard (accepts controlled filter props) ─────────────────────── */}
      <UablMetricasDashboard
        branches={branches}
        departments={departments}
        mes={mes}
        anio={anio}
        branchId={branchId}
        deptId={deptId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        triggerFetch={triggerFetch}
        onFetchStateChange={setPending}
      />

      <hr className="border-border" />

      {/* ── Snapshot comparativo (own period selector — historical trend) ───── */}
      <SnapshotComparativo />

      <hr className="border-border" />

      {/* ── Informe narrativo mensual (AI executive report) ─────────────────── */}
      <InformeNarrativoCard />
    </div>
  );
}
