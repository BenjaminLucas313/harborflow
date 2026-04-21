"use client";

// InformeNarrativoCard — Monthly AI-generated executive report for UABL operators.
//
// Renders:
//   - Month/year selector (defaults to current calendar month in Argentina)
//   - Loading state while fetching or generating
//   - When no informe exists: prominent "Generar Informe" call-to-action
//   - When informe exists: ReactMarkdown content + "Regenerar" + "Descargar PDF"

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown                                  from "react-markdown";
import { FileText, Loader2, RefreshCw, Download }    from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const YEARS: number[] = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => current - i);
})();

/** Returns current month and year in Argentina timezone (UTC-3). */
function argNow(): { mes: number; anio: number } {
  const utc    = new Date();
  const arg    = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return { mes: arg.getUTCMonth() + 1, anio: arg.getUTCFullYear() };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Informe = {
  id:         string;
  mes:        number;
  anio:       number;
  contenido:  string;
  generadoEn: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InformeNarrativoCard() {
  const { mes: mesDef, anio: anioDef } = argNow();
  const [mes,       setMes]       = useState<number>(mesDef);
  const [anio,      setAnio]      = useState<number>(anioDef);
  const [informe,   setInforme]   = useState<Informe | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Fetch existing informe ───────────────────────────────────────────────

  const fetchInforme = useCallback(async (m: number, a: number) => {
    setLoading(true);
    setError(null);
    setInforme(null);
    try {
      const res = await fetch(`/api/informes?mes=${m}&anio=${a}`);
      if (res.status === 204) {
        setInforme(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Error al cargar el informe.");
      }
      const body = await res.json();
      setInforme(body.data as Informe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInforme(mes, anio); }, [mes, anio, fetchInforme]);

  // ── Generate / regenerate ────────────────────────────────────────────────

  const handleGenerar = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/informes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mes, anio }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Error al generar el informe.");
      }
      const body = await res.json();
      setInforme(body.data as Informe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGenerating(false);
    }
  };

  // ── PDF download (browser print to PDF) ─────────────────────────────────

  const handleDownloadPdf = () => {
    if (!printRef.current || !informe) return;
    const mesNombre = MONTH_NAMES[informe.mes - 1] ?? `Mes ${informe.mes}`;
    const title     = `Informe HarborFlow — ${mesNombre} ${informe.anio}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; color: #111; line-height: 1.6; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
    p { margin: 0.5rem 0; }
    ul, ol { padding-left: 1.5rem; }
    strong { font-weight: 600; }
    .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Generado el ${new Date(informe.generadoEn).toLocaleDateString("es-AR", { dateStyle: "long" })}</p>
  ${printRef.current.innerHTML}
</body>
</html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const isBusy = loading || generating;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Informe Narrativo Mensual</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · Resumen ejecutivo generado por IA
          </span>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            disabled={isBusy}
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            disabled={isBusy}
            className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-5 py-5">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Cargando informe…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* No informe yet */}
        {!loading && !error && !informe && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No hay informe para {MONTH_NAMES[mes - 1]} {anio}</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Generá el informe ejecutivo mensual con un análisis narrativo basado en los datos operativos reales.
              </p>
            </div>
            <button
              onClick={handleGenerar}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
              ) : (
                <><FileText className="h-4 w-4" /> Generar Informe</>
              )}
            </button>
          </div>
        )}

        {/* Informe content */}
        {!loading && !error && informe && (
          <div className="space-y-4">

            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Generado el{" "}
                {new Date(informe.generadoEn).toLocaleDateString("es-AR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                  title="Descargar PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar PDF
                </button>
                <button
                  onClick={handleGenerar}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                  title="Regenerar informe"
                >
                  {generating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerando…</>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5" /> Regenerar</>
                  )}
                </button>
              </div>
            </div>

            {/* Markdown content */}
            <div
              ref={printRef}
              className="prose prose-sm dark:prose-invert max-w-none rounded-xl bg-muted/20 border border-border/50 px-5 py-4
                [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5
                [&_h3]:text-sm  [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                [&_p]:text-sm   [&_p]:leading-relaxed [&_p]:my-1.5
                [&_ul]:text-sm  [&_ul]:my-1.5 [&_li]:my-0.5
                [&_strong]:font-semibold"
            >
              <ReactMarkdown>{informe.contenido}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Generating overlay (when regenerating over existing content) */}
        {generating && informe && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Generando nuevo informe con IA… esto puede tomar unos segundos.
          </div>
        )}
      </div>
    </div>
  );
}
