"use client";

// MetricasPageClient — shared filter state and layout wrapper for /uabl/metricas.
//
// Owns the unified filter bar (Puerto · Mes · Año · Departamento · Desde · Hasta)
// and passes controlled filter values + triggerFetch to UablMetricasDashboard.
// SnapshotComparativo is rendered below with its own independent period selector.
// InformeNarrativoCard is rendered last — monthly AI executive report.

import { useState, useCallback, useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { Loader2, RefreshCw, Mail, CalendarCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { UablMetricasDashboard }    from "./UablMetricasDashboard";
import { MesActualCard }           from "./MesActualCard";
import { SnapshotComparativo }      from "./SnapshotComparativo";
import { InformeNarrativoCard }     from "./InformeNarrativoCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Branch = { id: string; name: string };
type Dept   = { id: string; name: string };

type EmailResult = { enviados: number; omitidos: number; errores: number };

type CierreResult = {
  mes:               number;
  anio:              number;
  yaRealizado?:      boolean;
  viajesLiquidados:  number;
  snapshotsGenerados: number;
  informesGenerados: number;
  emailsEnviados:    number;
  emailsOmitidos:    number;
  emailsErrores:     number;
  errores:           string[];
};

const CIERRE_STEPS = [
  "Calculando liquidaciones…",
  "Generando snapshot…",
  "Generando informe narrativo…",
  "Enviando emails…",
] as const;

type Props = {
  branches:        Branch[];
  departments:     Dept[];
  defaultMes:      number;
  defaultAnio:     number;
  defaultBranchId: string;
  isUablAdmin:     boolean;
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
  branches, departments, defaultMes, defaultAnio, defaultBranchId, isUablAdmin,
}: Props) {
  const [mes,          setMesRaw]       = useState(defaultMes);
  const [anio,         setAnioRaw]      = useState(defaultAnio);
  const [deptId,       setDeptId]       = useState("");
  const [branchId,     setBranchId]     = useState(defaultBranchId);
  const [dateFrom,     setDateFrom]     = useState(() => monthStart(defaultMes, defaultAnio));
  const [dateTo,       setDateTo]       = useState(() => monthEnd(defaultMes, defaultAnio));
  const [triggerFetch, setTriggerFetch] = useState(0);
  const [pending,      setPending]      = useState(false);

  // Email mensual state
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailResult,   setEmailResult]   = useState<EmailResult | null>(null);

  // Cierre mensual state
  const [showCierreModal,  setShowCierreModal]  = useState(false);
  const [ejecutandoCierre, setEjecutandoCierre] = useState(false);
  const [cierreStep,       setCierreStep]       = useState(0);
  const [cierreResult,     setCierreResult]     = useState<CierreResult | null>(null);
  const [cierreError,      setCierreError]      = useState<string | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handleEnviarEmail() {
    if (!window.confirm(
      `¿Enviar el resumen de ${MONTH_NAMES[mes - 1]} ${anio} a todos los departamentos con email configurado?`,
    )) return;

    setEnviandoEmail(true);
    setEmailResult(null);
    try {
      const res  = await fetch("/api/emails/mensual", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mes, anio }),
      });
      const json = await res.json() as EmailResult & { error?: { message: string } };
      if (!res.ok) throw new Error((json as { error?: { message: string } }).error?.message ?? "Error al enviar.");
      setEmailResult({ enviados: json.enviados, omitidos: json.omitidos, errores: json.errores });
    } catch (e) {
      setEmailResult({ enviados: 0, omitidos: 0, errores: -1 });
      console.error("[MetricasPageClient] handleEnviarEmail:", e);
    } finally {
      setEnviandoEmail(false);
    }
  }

  function startCierre() {
    setShowCierreModal(false);
    setEjecutandoCierre(true);
    setCierreResult(null);
    setCierreError(null);
    setCierreStep(0);

    // Cycle through step labels every 6s while the fetch runs.
    stepTimerRef.current = setInterval(() => {
      setCierreStep((s) => (s + 1) % CIERRE_STEPS.length);
    }, 6000);

    fetch("/api/jobs/cierre-mensual", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "X-Job-Secret":  process.env.NEXT_PUBLIC_JOB_SECRET ?? "",
      },
      body: JSON.stringify({ mes, anio }),
    })
      .then(async (res) => {
        const json = await res.json() as
          | { data: CierreResult }
          | { error: { code: string; message: string } };

        if (!res.ok || "error" in json) {
          const msg = "error" in json ? json.error.message : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        setCierreResult(json.data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setCierreError(msg);
        Sentry.captureException(err, { tags: { action: "cierre-mensual-manual" } });
      })
      .finally(() => {
        if (stepTimerRef.current) {
          clearInterval(stepTimerRef.current);
          stepTimerRef.current = null;
        }
        setEjecutandoCierre(false);
        setCierreStep(CIERRE_STEPS.length - 1);
      });
  }

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

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

      {/* ── Admin actions (solo isUablAdmin) ────────────────────────────────── */}
      {isUablAdmin && (
        <div className="space-y-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Enviar resumen mensual por email */}
            <button
              type="button"
              onClick={() => { void handleEnviarEmail(); }}
              disabled={enviandoEmail}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {enviandoEmail
                ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                : <Mail    className="size-4"              aria-hidden="true" />
              }
              {enviandoEmail ? "Enviando…" : "Enviar resumen mensual por email"}
            </button>

            {/* Ejecutar cierre mensual */}
            <button
              type="button"
              onClick={() => setShowCierreModal(true)}
              disabled={ejecutandoCierre}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {ejecutandoCierre
                ? <Loader2      className="size-4 animate-spin" aria-hidden="true" />
                : <CalendarCheck className="size-4"             aria-hidden="true" />
              }
              {ejecutandoCierre ? CIERRE_STEPS[cierreStep] : "Ejecutar cierre mensual"}
            </button>
          </div>

          {/* Email result feedback */}
          {emailResult && emailResult.errores === -1 && (
            <p className="text-sm text-destructive">
              Error al enviar los emails. Revisá los logs del servidor.
            </p>
          )}
          {emailResult && emailResult.errores !== -1 && (
            <p className="text-sm text-muted-foreground">
              <span className="text-emerald-600 font-medium">{emailResult.enviados} enviado{emailResult.enviados !== 1 ? "s" : ""}</span>
              {emailResult.omitidos > 0 && <> · {emailResult.omitidos} omitido{emailResult.omitidos !== 1 ? "s" : ""} (sin email)</>}
              {emailResult.errores  > 0 && <> · <span className="text-destructive">{emailResult.errores} error{emailResult.errores !== 1 ? "es" : ""}</span></>}
            </p>
          )}

          {/* Cierre mensual: loading steps */}
          {ejecutandoCierre && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1.5">
              {CIERRE_STEPS.map((step, i) => (
                <div key={step} className={`flex items-center gap-2 text-sm transition-opacity ${i <= cierreStep ? "opacity-100" : "opacity-30"}`}>
                  {i < cierreStep
                    ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    : i === cierreStep
                      ? <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                      : <div className="size-4 rounded-full border border-muted-foreground/30 shrink-0" />
                  }
                  <span className={i === cierreStep ? "font-medium" : "text-muted-foreground"}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cierre mensual: result */}
          {cierreResult && !ejecutandoCierre && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1.5 text-sm">
              {cierreResult.yaRealizado ? (
                <p className="font-medium text-emerald-700">
                  Cierre ya realizado para {MONTH_NAMES[(cierreResult.mes ?? mes) - 1]} {cierreResult.anio ?? anio}.
                </p>
              ) : (
                <>
                  <p className="font-medium text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    Cierre mensual completado — {MONTH_NAMES[(cierreResult.mes ?? mes) - 1]} {cierreResult.anio ?? anio}
                  </p>
                  <ul className="text-emerald-800 space-y-0.5 pl-1">
                    <li>· {cierreResult.viajesLiquidados} viaje{cierreResult.viajesLiquidados !== 1 ? "s" : ""} liquidado{cierreResult.viajesLiquidados !== 1 ? "s" : ""}</li>
                    <li>· {cierreResult.snapshotsGenerados} snapshot{cierreResult.snapshotsGenerados !== 1 ? "s" : ""} generado{cierreResult.snapshotsGenerados !== 1 ? "s" : ""}</li>
                    <li>· {cierreResult.informesGenerados} informe{cierreResult.informesGenerados !== 1 ? "s" : ""} narrativo{cierreResult.informesGenerados !== 1 ? "s" : ""}</li>
                    <li>· {cierreResult.emailsEnviados} email{cierreResult.emailsEnviados !== 1 ? "s" : ""} enviado{cierreResult.emailsEnviados !== 1 ? "s" : ""}
                      {cierreResult.emailsOmitidos > 0 && <>, {cierreResult.emailsOmitidos} omitido{cierreResult.emailsOmitidos !== 1 ? "s" : ""}</>}
                    </li>
                  </ul>
                  {cierreResult.errores.length > 0 && (
                    <p className="text-amber-700 text-xs mt-1">
                      {cierreResult.errores.length} error{cierreResult.errores.length !== 1 ? "es" : ""} no crítico{cierreResult.errores.length !== 1 ? "s" : ""} — revisá los logs del servidor.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Cierre mensual: error */}
          {cierreError && !ejecutandoCierre && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-sm text-red-700">
              <XCircle className="size-4 mt-0.5 shrink-0" />
              <span><span className="font-medium">Error al ejecutar el cierre:</span> {cierreError}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de confirmación: cierre mensual ───────────────────────────── */}
      {showCierreModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cierre-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="size-5 text-amber-600" />
              </div>
              <div>
                <h2 id="cierre-dialog-title" className="font-semibold text-base">
                  ¿Ejecutar cierre mensual?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se calcularán liquidaciones, se generará el snapshot y el informe narrativo, y se enviarán los emails de resumen a todos los departamentos para{" "}
                  <span className="font-medium">{MONTH_NAMES[mes - 1]} {anio}</span>.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Esta operación puede tardar hasta 60 segundos.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCierreModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={startCierre}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Ejecutar cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mes en curso — tiempo real (sin snapshot) ───────────────────────── */}
      <MesActualCard />

      <hr className="border-border" />

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
