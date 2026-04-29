"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Anchor,
  Send,
  Users,
  History,
  Loader2,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Actor = {
  firstName: string;
  lastName:  string;
  role:      string;
};

type Evento = {
  id:         string;
  action:     string;
  entityType: string;
  payload:    unknown;
  createdAt:  string; // ISO string after JSON serialization
  actor:      Actor | null;
};

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<string, string> = {
  // Trip lifecycle
  TRIP_CREATED:              "Viaje creado",
  TRIP_STATUS_CHANGED:       "Estado del viaje cambiado",
  TRIP_CAPACITY_CHANGED:     "Capacidad modificada",
  TRIP_DESAUTOMATIZADO:      "Automatización desactivada",
  // Trip requests
  TRIP_REQUEST_CREATED:      "Solicitud de viaje creada",
  TRIP_REQUEST_ACCEPTED:     "Solicitud de viaje aceptada",
  TRIP_REQUEST_REJECTED:     "Solicitud de viaje rechazada",
  TRIP_REQUEST_CANCELLED:    "Solicitud de viaje cancelada",
  // Group booking lifecycle
  GROUP_BOOKING_CREATED:     "Reserva grupal creada",
  GROUP_BOOKING_SUBMITTED:   "Reserva grupal enviada",
  GROUP_BOOKING_CANCELLED:   "Reserva grupal cancelada",
  GROUP_BOOKING_SLOT_ADDED:  "Pasajero agregado a reserva",
  // Passenger slot lifecycle
  SLOT_CONFIRMED:            "Pasajero aprobado",
  SLOT_REJECTED:             "Pasajero rechazado",
  SLOT_CANCELLED:            "Pasajero cancelado",
  SLOT_REVERTED:             "Aprobación revertida",
  // Trip closure / reporting
  LIQUIDACION_CALCULADA:     "Liquidación calculada",
  LIQUIDACION_RECALCULADA:   "Liquidación recalculada",
  VIAJE_MARCADO_PASADO:      "Viaje marcado como pasado",
  ANOMALIA_NOTIFICADA:       "Anomalía notificada",
  INFORME_GENERADO:          "Informe generado",
  // Port / notices
  PORT_STATUS_CHANGED:       "Estado del puerto cambiado",
  NOTICE_CREATED:            "Aviso publicado",
  NOTICE_DEACTIVATED:        "Aviso desactivado",
  // Legacy reservation
  RESERVATION_CREATED:       "Reserva creada",
  RESERVATION_CANCELLED:     "Reserva cancelada",
  RESERVATION_REPLACED:      "Reserva reemplazada",
  RESERVATION_CHECKED_IN:    "Check-in registrado",
  RESERVATION_NO_SHOW:       "No presentado",
  WAITLIST_JOINED:           "Ingresó a lista de espera",
  WAITLIST_PROMOTED:         "Promovido de lista de espera",
  WAITLIST_CANCELLED:        "Lista de espera cancelada",
  WAITLIST_EXPIRED:          "Lista de espera expirada",
};

const TRIP_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  BOARDING:  "Embarcando",
  DELAYED:   "Demorado",
  CANCELLED: "Cancelado",
  DEPARTED:  "Partido",
  COMPLETED: "Completado",
};

const ROLE_LABEL: Record<string, string> = {
  UABL:      "UABL",
  PROVEEDOR: "Proveedor",
  EMPRESA:   "Empresa",
  USUARIO:   "Usuario",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionLabel(action: string, payload: unknown): string {
  if (action === "TRIP_STATUS_CHANGED" && payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.from === "string" && typeof p.to === "string") {
      const from = TRIP_STATUS_LABEL[p.from] ?? p.from;
      const to   = TRIP_STATUS_LABEL[p.to]   ?? p.to;
      return `Estado: ${from} → ${to}`;
    }
  }
  return ACTION_LABEL[action] ?? action;
}

function extractPayloadInfo(action: string, payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const parts: string[] = [];

  // Don't double-display from/to for status changes (already in the label).
  if (action !== "TRIP_STATUS_CHANGED") {
    if (typeof p.from === "string" && typeof p.to === "string") {
      parts.push(`${p.from} → ${p.to}`);
    }
  }
  const reason = p.reason ?? p.motivo ?? p.message;
  if (typeof reason === "string" && reason.trim()) {
    parts.push(`Motivo: ${reason.trim()}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

type IconConfig = {
  icon:        React.ElementType;
  iconColor:   string;
  dotBorder:   string;
};

function getIconConfig(action: string): IconConfig {
  if (
    action.includes("CONFIRMED") ||
    action.includes("ACCEPTED") ||
    action === "TRIP_CREATED" ||
    action === "TRIP_REQUEST_CREATED" ||
    action === "GROUP_BOOKING_CREATED" ||
    action === "WAITLIST_PROMOTED" ||
    action === "RESERVATION_CHECKED_IN"
  ) {
    return { icon: CheckCircle2, iconColor: "text-emerald-500", dotBorder: "border-emerald-200" };
  }
  if (
    action.includes("REJECTED") ||
    action.includes("CANCELLED") ||
    action === "RESERVATION_NO_SHOW" ||
    action === "WAITLIST_EXPIRED"
  ) {
    return { icon: XCircle, iconColor: "text-red-400", dotBorder: "border-red-200" };
  }
  if (action === "GROUP_BOOKING_SUBMITTED" || action === "SLOT_REVERTED") {
    return { icon: Send, iconColor: "text-blue-500", dotBorder: "border-blue-200" };
  }
  if (action.includes("GROUP_BOOKING") || action.includes("SLOT")) {
    return { icon: Users, iconColor: "text-violet-500", dotBorder: "border-violet-200" };
  }
  if (
    action.includes("STATUS_CHANGED") ||
    action.includes("CAPACITY") ||
    action === "TRIP_DESAUTOMATIZADO"
  ) {
    return { icon: RefreshCw, iconColor: "text-amber-500", dotBorder: "border-amber-200" };
  }
  if (
    action.includes("LIQUIDACION") ||
    action === "VIAJE_MARCADO_PASADO" ||
    action === "INFORME_GENERADO"
  ) {
    return { icon: Anchor, iconColor: "text-slate-400", dotBorder: "border-slate-200" };
  }
  return { icon: Clock, iconColor: "text-slate-400", dotBorder: "border-slate-200" };
}

function formatRelativeTime(iso: string): string {
  const date    = new Date(iso);
  const now     = new Date();
  const diffMs  = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1)  return "hace un momento";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr  < 24) return `hace ${diffHr} h`;
  if (diffDay === 1) return "ayer";
  if (diffDay < 7)  return `hace ${diffDay} días`;

  return date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day:      "numeric",
    month:    "long",
    ...(diffDay > 365 ? { year: "numeric" } : {}),
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_EVENTOS = 100;

export function TripHistorial({ tripId }: { tripId: string }) {
  const [eventos,     setEventos]     = useState<Evento[]>([]);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const qs  = cursor ? `?cursor=${cursor}` : "";
      const res = await fetch(`/api/trips/${tripId}/historial${qs}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json() as {
        data: { eventos: Evento[]; nextCursor: string | null };
      };
      return json.data;
    },
    [tripId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage()
      .then(({ eventos: e, nextCursor: nc }) => {
        if (cancelled) return;
        setEventos(e);
        setNextCursor(nc);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchPage]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { eventos: more, nextCursor: nc } = await fetchPage(nextCursor);
      setEventos((prev) => {
        const combined = [...prev, ...more];
        return combined.slice(0, MAX_EVENTOS);
      });
      // If we'd exceed the limit, stop regardless of server cursor.
      setNextCursor((prev) => {
        const total = eventos.length + more.length;
        return total >= MAX_EVENTOS ? null : nc;
      });
    } catch {
      // Silently ignore load-more errors — user can retry.
    } finally {
      setLoadingMore(false);
    }
  }

  const atLimit = eventos.length >= MAX_EVENTOS;

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Cargando historial" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
        <History className="size-9 opacity-25" aria-hidden="true" />
        <p className="text-sm">No hay eventos registrados para este viaje.</p>
      </div>
    );
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  return (
    <div>
      <ul className="relative">
        {eventos.map((evento, i) => {
          const { icon: Icon, iconColor, dotBorder } = getIconConfig(evento.action);
          const label       = getActionLabel(evento.action, evento.payload);
          const payloadInfo = extractPayloadInfo(evento.action, evento.payload);
          const timeLabel   = formatRelativeTime(evento.createdAt);
          const actorName   = evento.actor
            ? `${evento.actor.firstName} ${evento.actor.lastName}`
            : "Sistema";
          const rolLabel    = evento.actor
            ? (ROLE_LABEL[evento.actor.role] ?? evento.actor.role)
            : "";
          const isLast = i === eventos.length - 1;

          return (
            <li key={evento.id} className="flex gap-4">
              {/* Timeline spine */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`z-10 mt-0.5 rounded-full border-2 bg-background p-1 ${dotBorder}`}>
                  <Icon className={`size-3.5 ${iconColor}`} aria-hidden="true" />
                </div>
                {!isLast && (
                  <div className="flex-1 w-px bg-border/60 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${isLast ? "pb-2" : "pb-5"}`}>
                <p className="text-sm font-medium leading-snug">{label}</p>
                {payloadInfo && (
                  <p className="text-xs text-muted-foreground mt-0.5">{payloadInfo}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {actorName}
                  {rolLabel && <> · <span className="opacity-70">{rolLabel}</span></>}
                  {" · "}
                  {timeLabel}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Load more / limit reached */}
      {atLimit ? (
        <p className="mt-4 text-xs text-center text-muted-foreground">
          Mostrando los últimos {MAX_EVENTOS} eventos
        </p>
      ) : nextCursor ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {loadingMore ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
            {loadingMore ? "Cargando…" : "Ver más eventos"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
