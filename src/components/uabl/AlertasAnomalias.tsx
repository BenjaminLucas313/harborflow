"use client";

// AlertasAnomalias — Real-time anomaly detection panel for UABL dashboard.
//
// Fetches from GET /api/anomalias every 5 minutes.
// Renders one card per anomaly, colour-coded by severity:
//   critica → red    (border-red-300 bg-red-50 text-red-*)
//   alta    → orange (border-orange-300 bg-orange-50 text-orange-*)
//   media   → yellow (border-yellow-300 bg-yellow-50 text-yellow-*)
//
// Each card has a "Notificar al operador" button that POSTs to
// /api/anomalias/notificar and shows one-shot feedback.

import { useCallback, useEffect, useState } from "react";
import type { Anomalia } from "@/services/anomalias.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotifyState = "idle" | "loading" | "done" | "error";
type NotifyError = string | null;

// ---------------------------------------------------------------------------
// Severity palette
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<
  Anomalia["severidad"],
  {
    card:   string;
    badge:  string;
    title:  string;
    body:   string;
    label:  string;
    btn:    string;
    btnHov: string;
  }
> = {
  critica: {
    card:   "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
    badge:  "bg-red-600 text-white",
    title:  "text-red-800 dark:text-red-300",
    body:   "text-red-700 dark:text-red-400",
    label:  "Crítica",
    btn:    "border-red-400 text-red-700 dark:border-red-700 dark:text-red-300",
    btnHov: "hover:bg-red-100 dark:hover:bg-red-900/40",
  },
  alta: {
    card:   "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40",
    badge:  "bg-orange-500 text-white",
    title:  "text-orange-800 dark:text-orange-300",
    body:   "text-orange-700 dark:text-orange-400",
    label:  "Alta",
    btn:    "border-orange-400 text-orange-700 dark:border-orange-700 dark:text-orange-300",
    btnHov: "hover:bg-orange-100 dark:hover:bg-orange-900/40",
  },
  media: {
    card:   "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/40",
    badge:  "bg-yellow-500 text-white",
    title:  "text-yellow-800 dark:text-yellow-300",
    body:   "text-yellow-700 dark:text-yellow-400",
    label:  "Media",
    btn:    "border-yellow-400 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300",
    btnHov: "hover:bg-yellow-100 dark:hover:bg-yellow-900/40",
  },
};

// ---------------------------------------------------------------------------
// AnomaliaCard
// ---------------------------------------------------------------------------

function AnomaliaCard({ anomalia }: { anomalia: Anomalia }) {
  const [notify,      setNotify]      = useState<NotifyState>("idle");
  const [notifyError, setNotifyError] = useState<NotifyError>(null);
  const styles = SEVERITY_STYLES[anomalia.severidad];

  async function handleNotificar() {
    setNotify("loading");
    setNotifyError(null);
    try {
      const res = await fetch("/api/anomalias/notificar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          anomaliaId: anomalia.id,
          tipo:       anomalia.tipo,
          titulo:     anomalia.titulo,
        }),
      });

      if (res.ok) {
        setNotify("done");
      } else {
        const json = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        const msg  = json?.error?.message ?? `Error ${res.status}`;
        console.error("[AlertasAnomalias] notificar falló:", res.status, json);
        setNotifyError(msg);
        setNotify("error");
      }
    } catch (err) {
      console.error("[AlertasAnomalias] notificar error de red:", err);
      setNotifyError("Error de conexión. Intentá de nuevo.");
      setNotify("error");
    }
  }

  return (
    <article
      className={`rounded-xl border p-4 space-y-2.5 ${styles.card}`}
      aria-label={`Anomalía ${anomalia.severidad}: ${anomalia.titulo}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-semibold leading-snug ${styles.title}`}>
          {anomalia.titulo}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}
        >
          {styles.label}
        </span>
      </div>

      {/* Description */}
      <p className={`text-xs leading-relaxed ${styles.body}`}>
        {anomalia.descripcion}
      </p>

      {/* Suggested action */}
      <p className={`text-xs font-medium ${styles.body}`}>
        → {anomalia.accion}
      </p>

      {/* Notify button */}
      <div className="pt-1">
        {notify === "done" ? (
          <p className={`text-xs font-medium ${styles.title}`}>
            ✓ Operador notificado
          </p>
        ) : notify === "error" ? (
          <div className="space-y-1">
            <p className="text-xs text-red-600 dark:text-red-400">
              {notifyError ?? "Error al notificar. Intentá de nuevo."}
            </p>
            <button
              onClick={() => { setNotify("idle"); setNotifyError(null); }}
              className="text-xs underline text-red-600 dark:text-red-400 hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <button
            onClick={() => { void handleNotificar(); }}
            disabled={notify === "loading"}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${styles.btn} ${styles.btnHov}`}
          >
            {notify === "loading" ? "Notificando…" : "Notificar al operador"}
          </button>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export function AlertasAnomalias() {
  const [anomalias,  setAnomalias]  = useState<Anomalia[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [generadoEn, setGeneradoEn] = useState<string | null>(null);

  const fetchAnomalias = useCallback(async () => {
    setError(null);
    try {
      const res  = await fetch("/api/anomalias");
      if (!res.ok) throw new Error(`${res.status}`);
      const body = await res.json() as { anomalias?: Anomalia[]; generadoEn?: string };
      setAnomalias(body.anomalias ?? []);
      setGeneradoEn(body.generadoEn ?? null);
    } catch {
      setError("No se pudieron cargar las alertas. Revisá tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { void fetchAnomalias(); }, [fetchAnomalias]);

  // Auto-refresh every 5 min
  useEffect(() => {
    const id = setInterval(() => { void fetchAnomalias(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAnomalias]);

  const criticas = anomalias.filter((a) => a.severidad === "critica").length;

  return (
    <section aria-labelledby="alertas-heading" className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h2 id="alertas-heading" className="text-lg font-semibold">
          Alertas operativas
        </h2>
        {criticas > 0 && (
          <span
            className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white"
            aria-label={`${criticas} anomalía${criticas !== 1 ? "s" : ""} crítica${criticas !== 1 ? "s" : ""}`}
          >
            {criticas} crítica{criticas !== 1 ? "s" : ""}
          </span>
        )}
        {generadoEn && (
          <span className="ml-auto text-xs text-muted-foreground">
            Actualizado{" "}
            {new Intl.DateTimeFormat("es-AR", {
              hour:     "2-digit",
              minute:   "2-digit",
              timeZone: "America/Argentina/Buenos_Aires",
            }).format(new Date(generadoEn))}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <span className="animate-pulse">Verificando anomalías…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
          <button
            onClick={() => { void fetchAnomalias(); }}
            className="ml-3 underline text-red-700 dark:text-red-400 hover:no-underline text-xs"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && anomalias.length === 0 && (
        <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-6 py-8 text-center space-y-1">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">
            Sin anomalías detectadas
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500">
            La operación marcha dentro de los parámetros normales.
          </p>
        </div>
      )}

      {/* Anomaly cards */}
      {!loading && !error && anomalias.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {anomalias.map((a) => (
            <AnomaliaCard key={a.id} anomalia={a} />
          ))}
        </div>
      )}
    </section>
  );
}
