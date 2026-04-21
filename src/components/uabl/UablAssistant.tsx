"use client";

// =============================================================================
// UablAssistant — UABL AI assistant panel
// =============================================================================
//
// Design spec (v2):
//   bg principal:    #0d1b35
//   bg header:       linear-gradient(160deg, #0a1628, #0e2147)
//   bg mensajes IA:  #f8faff  | texto #1a2e50  | border rgba(200,220,248,0.4)
//   bg msg usuario:  #1e3f7a  | texto #dceeff
//   bg recs:         #091222
//   azul acento:     #1e4d9e  hover #2563bd
//   texto principal: #f0f6ff
//   texto secundario:#4d72a8
//   texto pills:     #90b8e0
//   verde:           #34d399
//   amarillo warn:   #fbbf24
//
// Sections:
//   1. Header  — mascot SVG (72px, bob anim), pulsing ring, title 20px/500
//   2. KPI bar — 4 metrics, 2×2 mobile / 4-col desktop, overflow ellipsis + title tooltip
//   3. Chat    — IA (ReactMarkdown, border) · user (dceeff) · typing indicator
//   4. Pills + Input — suggestion pills, input, send button
//   5. Recs    — priority cards 1-col/3-col, implementadas counter
//
// =============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, RefreshCw, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AdminMetrics } from "@/modules/metrics/admin-service";
import { useConfirmPop } from "@/hooks/useButtonAnimation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message = {
  role:    "user" | "assistant";
  content: string;
};

type Recomendacion = {
  id:                     string;
  titulo:                 string;
  descripcion:            string;
  ahorroEstimadoAsientos: number;
  prioridad:              "ALTA" | "MEDIA" | "BAJA";
  estado:                 "ACTIVA" | "IMPLEMENTADA" | "DESCARTADA";
};

export type UablAssistantProps = {
  mes:        number;
  anio:       number;
  branchName: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const SUGGESTIONS = [
  "Viajes de hoy",
  "Lancha subutilizada",
  "Simular consolidación",
  "Mayor generador vacíos",
  "Comparar con mes anterior",
];

const PRIORIDAD_BORDER: Record<string, string> = {
  ALTA:  "#ef4444",
  MEDIA: "#fbbf24",
  BAJA:  "#3b82f6",
};

const PRIORIDAD_BADGE_BG: Record<string, string> = {
  ALTA:  "rgba(239,68,68,0.14)",
  MEDIA: "rgba(251,191,36,0.14)",
  BAJA:  "rgba(59,130,246,0.14)",
};

const PRIORIDAD_BADGE_TEXT: Record<string, string> = {
  ALTA:  "#f87171",
  MEDIA: "#fbbf24",
  BAJA:  "#60a5fa",
};

const PRIORIDAD_LABEL: Record<string, string> = {
  ALTA:  "Alta prioridad",
  MEDIA: "Media prioridad",
  BAJA:  "Baja prioridad",
};

// All CSS animations in one block — injected once in the component root
const ANIM_CSS = `
  @keyframes uabl-dot {
    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
    40%            { opacity: 1;   transform: translateY(-4px); }
  }
  @keyframes uabl-pulse {
    0%   { box-shadow: 0 0 0 0   rgba(52,211,153,0.55); }
    70%  { box-shadow: 0 0 0 8px rgba(52,211,153,0);    }
    100% { box-shadow: 0 0 0 0   rgba(52,211,153,0);    }
  }
  @keyframes uabl-bob {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes uabl-ring {
    0%   { transform: scale(1);    opacity: 0.55; }
    70%  { transform: scale(1.22); opacity: 0;    }
    100% { transform: scale(1);    opacity: 0;    }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

// ---------------------------------------------------------------------------
// ImplementarButton — isolated so useConfirmPop can be called per card
// ---------------------------------------------------------------------------

function ImplementarButton({ onConfirm }: { onConfirm: () => void }) {
  const pop = useConfirmPop();
  return (
    <button
      onClick={() => { pop.trigger(); onConfirm(); }}
      className={pop.className}
      style={{
        flex:            1,
        backgroundColor: "transparent",
        border:          "1px solid rgba(255,255,255,0.14)",
        borderRadius:    "7px",
        color:           "#90b8e0",
        fontSize:        "12px",
        fontWeight:      500,
        padding:         "7px 4px",
        cursor:          "pointer",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        gap:             "5px",
        transition:      "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.backgroundColor = "rgba(52,211,153,0.1)";
        el.style.color = "#34d399";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.backgroundColor = "transparent";
        el.style.color = "#90b8e0";
      }}
    >
      <Check size={12} />
      Implementar
    </button>
  );
}

// ---------------------------------------------------------------------------
// Boat mascot SVG (72 × 72)
// ---------------------------------------------------------------------------

function BoatMascot() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={72}
      height={72}
    >
      {/* Background circle */}
      <circle cx="40" cy="40" r="40" fill="#1a3560" />

      {/* Sun */}
      <circle cx="20" cy="18" r="6" fill="#fbbf24" />
      <line x1="20" y1="9"  x2="20" y2="7"  stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="12" x2="29" y2="10" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="20" x2="31" y2="20" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="12" x2="11" y2="10" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="20" x2="9"  y2="20" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />

      {/* Mast */}
      <line x1="42" y1="40" x2="42" y2="20" stroke="#94a3b8" strokeWidth="2" />

      {/* Sail */}
      <path d="M42 20 L60 29 L42 34 Z" fill="#ef4444" />

      {/* Cabin */}
      <rect x="26" y="40" width="28" height="16" rx="5" fill="#f0f6ff" />

      {/* Eyes */}
      <circle cx="35" cy="46" r="3" fill="#1a2e50" />
      <circle cx="45" cy="46" r="3" fill="#1a2e50" />
      <circle cx="36.2" cy="44.8" r="1.1" fill="white" />
      <circle cx="46.2" cy="44.8" r="1.1" fill="white" />

      {/* Smile */}
      <path
        d="M33 52 Q40 58 47 52"
        stroke="#1a2e50"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Hull */}
      <path d="M14 56 L20 64 L60 64 L66 56 Z" fill="white" />

      {/* Water */}
      <path
        d="M4 65 Q12 61 20 65 Q28 69 36 65 Q44 61 52 65 Q60 69 68 65 Q74 63 76 65 L76 80 L4 80 Z"
        fill="#1e3f7a"
        opacity="0.6"
      />

      {/* Smoke */}
      <circle cx="56" cy="36" r="3"   fill="white" opacity="0.35" />
      <circle cx="61" cy="32" r="2.2" fill="white" opacity="0.25" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div
      style={{
        backgroundColor: "#f8faff",
        borderRadius:    "14px 14px 14px 2px",
        border:          "1px solid rgba(200,220,248,0.4)",
      }}
      className="inline-flex gap-1.5 items-center px-4 py-3 max-w-fit"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:           7,
            height:          7,
            borderRadius:    "50%",
            backgroundColor: "#4d72a8",
            animation:       "uabl-dot 1.4s ease-in-out infinite",
            animationDelay:  `${i * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

type KpiCardProps = {
  label: string;
  value: string;
  sub:   string;
  warn?: boolean;
};

function KpiCard({ label, value, sub, warn }: KpiCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#0d1b35",
        // inset shadow creates the 1px divider lines without outer border bleed
        boxShadow:       "inset -1px -1px 0 rgba(255,255,255,0.04)",
        padding:         "16px 18px",
        minWidth:        0,   // allow flex/grid children to shrink
      }}
    >
      <p
        style={{
          color:         "#3d5f8a",
          fontSize:      "10px",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontWeight:    600,
          marginBottom:  "6px",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}
      >
        {label}
      </p>
      {/* title= gives the native browser tooltip on hover — shows full value */}
      <p
        title={value}
        style={{
          color:        warn ? "#fbbf24" : "#f0f6ff",
          fontSize:     "19px",
          fontWeight:   500,
          lineHeight:   1,
          marginBottom: "5px",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}
      >
        {value}
      </p>
      <p
        style={{
          color:        "#3b82c4",
          fontSize:     "10px",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}
      >
        {sub}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UablAssistant({ mes, anio, branchName }: UablAssistantProps) {
  const mesNombre = MONTH_NAMES[mes - 1] ?? String(mes);

  // ── State ──────────────────────────────────────────────────────────────
  const [metrics, setMetrics]               = useState<AdminMetrics | null>(null);
  const [loadingKpi, setLoadingKpi]         = useState(true);

  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState("");
  const [loadingChat, setLoadingChat]       = useState(false);
  const [chatError, setChatError]           = useState<string | null>(null);
  const messagesEndRef                      = useRef<HTMLDivElement>(null);

  const [recs, setRecs]                     = useState<Recomendacion[]>([]);
  const [loadingRecs, setLoadingRecs]       = useState(false);
  const [generatingRecs, setGeneratingRecs] = useState(false);
  const [recsError, setRecsError]           = useState<string | null>(null);

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchKpi = useCallback(async () => {
    setLoadingKpi(true);
    try {
      const res  = await fetch(`/api/metricas?mes=${mes}&anio=${anio}`);
      const json = await res.json() as { data?: AdminMetrics };
      if (json.data) setMetrics(json.data);
    } catch {
      // silently fail — KPIs show dashes
    } finally {
      setLoadingKpi(false);
    }
  }, [mes, anio]);

  const fetchRecs = useCallback(async () => {
    setLoadingRecs(true);
    setRecsError(null);
    try {
      const res  = await fetch(`/api/uabl/recomendaciones?mes=${mes}&anio=${anio}`);
      const json = await res.json() as { recomendaciones?: Recomendacion[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar recomendaciones");
      setRecs(json.recomendaciones ?? []);
    } catch (e) {
      setRecsError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoadingRecs(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    void fetchKpi();
    void fetchRecs();
  }, [fetchKpi, fetchRecs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingChat]);

  // ── Derived KPIs ────────────────────────────────────────────────────────

  const topDepto = metrics?.resumenPorDepto
    .slice()
    .sort((a, b) => b.asientosConfirmados - a.asientosConfirmados)[0];

  const avgCapacity =
    metrics && metrics.totalViajesDelPeriodo > 0
      ? (metrics.promedioOcupacion * 10).toFixed(1)
      : "—";

  // ── Handlers ────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loadingChat) return;

    setInput("");
    setChatError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoadingChat(true);

    try {
      const res  = await fetch("/api/uabl/assistant", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pregunta: question, mes, anio }),
      });
      const json = await res.json() as { respuesta?: string; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Error al consultar");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.respuesta ?? "Sin respuesta." },
      ]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Error desconocido");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoadingChat(false);
    }
  }

  async function generateRecs() {
    setGeneratingRecs(true);
    setRecsError(null);
    try {
      const res  = await fetch("/api/uabl/recomendaciones", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mes, anio }),
      });
      const json = await res.json() as { recomendaciones?: Recomendacion[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Error al generar");
      setRecs(json.recomendaciones ?? []);
    } catch (e) {
      setRecsError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGeneratingRecs(false);
    }
  }

  async function updateEstado(id: string, estado: "IMPLEMENTADA" | "DESCARTADA") {
    try {
      const res = await fetch(`/api/uabl/recomendaciones/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ estado }),
      });
      if (!res.ok) return;
      setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
    } catch {
      // silent fail
    }
  }

  // ── Derived render values ───────────────────────────────────────────────

  const activeRecs        = recs.filter((r) => r.estado === "ACTIVA");
  const implementadasCount = recs.filter((r) => r.estado === "IMPLEMENTADA").length;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        backgroundColor: "#0d1b35",
        borderRadius:    "16px",
        overflow:        "hidden",
        wordBreak:       "break-word",
        overflowWrap:    "break-word",
      }}
      className="w-full"
    >
      {/* ── Global keyframe animations ─────────────────────────────────────── */}
      <style>{ANIM_CSS}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background:   "linear-gradient(160deg, #0a1628 0%, #0e2147 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        className="flex flex-col items-center px-6 pt-8 pb-6 text-center"
      >
        {/* Mascot + pulsing ring */}
        <div
          style={{ position: "relative", display: "inline-block", marginBottom: "18px" }}
        >
          {/* Ring — animates outward and fades */}
          <div
            aria-hidden="true"
            style={{
              position:      "absolute",
              inset:         "-10px",
              borderRadius:  "50%",
              border:        "2px solid rgba(52,211,153,0.38)",
              animation:     "uabl-ring 2.4s ease-out infinite",
              pointerEvents: "none",
            }}
          />
          {/* Mascot container — bobs up and down */}
          <div
            style={{
              borderRadius: "50%",
              background:   "linear-gradient(145deg, #1e3a5f, #0f2344)",
              padding:      "11px",
              boxShadow:    "0 6px 28px rgba(0,0,0,0.5)",
              animation:    "uabl-bob 3.2s ease-in-out infinite",
            }}
          >
            <BoatMascot />
          </div>
        </div>

        {/* Title */}
        <h2
          style={{
            color:        "#f0f6ff",
            fontSize:     "20px",
            fontWeight:   500,
            marginBottom: "4px",
            letterSpacing: "-0.01em",
          }}
        >
          UABL Assistant
        </h2>

        {/* Subtitle */}
        <p style={{ color: "#4d72a8", fontSize: "12px" }}>
          Análisis operativo · {branchName} · {mesNombre} {anio}
        </p>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 mt-3">
          <span
            aria-hidden="true"
            style={{
              width:           8,
              height:          8,
              borderRadius:    "50%",
              backgroundColor: "#34d399",
              display:         "inline-block",
              flexShrink:      0,
              animation:       "uabl-pulse 2s ease-in-out infinite",
            }}
          />
          <span style={{ color: "#34d399", fontSize: "12px" }}>
            Conectado a datos en tiempo real
          </span>
        </div>
      </div>

      {/* ── KPI grid (2×2 mobile / 4-col desktop) ──────────────────────────── */}
      <div
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        className="grid grid-cols-2 md:grid-cols-4"
      >
        <KpiCard
          label="VIAJES ESTE MES"
          value={loadingKpi ? "—" : String(metrics?.totalViajesDelPeriodo ?? "—")}
          sub="del período"
        />
        <KpiCard
          label="OCUPACIÓN PROM."
          value={
            loadingKpi ? "—"
            : metrics  ? `${(metrics.promedioOcupacion * 100).toFixed(1)}%`
            : "—"
          }
          sub={`${avgCapacity} / 10 asientos`}
        />
        <KpiCard
          label="SIN LIQUIDAR"
          value={loadingKpi ? "—" : String(metrics?.viajesSinLiquidar ?? "—")}
          sub="viajes pendientes"
          warn={(metrics?.viajesSinLiquidar ?? 0) > 0}
        />
        {/* Full dept name passed — KpiCard truncates with CSS + title tooltip */}
        <KpiCard
          label="MAYOR GASTO"
          value={
            loadingKpi  ? "—"
            : topDepto  ? topDepto.departamentoNombre
            : "—"
          }
          sub={topDepto ? `${topDepto.asientosConfirmados} asientos conf.` : "sin datos"}
        />
      </div>

      {/* ── Chat area ──────────────────────────────────────────────────────── */}
      <div
        style={{ minHeight: "220px", maxHeight: "420px", overflowY: "auto" }}
        className="px-5 py-5 space-y-4"
      >
        {/* Welcome */}
        {messages.length === 0 && !loadingChat && (
          <div className="flex justify-start">
            <div
              style={{
                backgroundColor: "#f8faff",
                color:           "#1a2e50",
                borderRadius:    "14px 14px 14px 2px",
                border:          "1px solid rgba(200,220,248,0.4)",
                maxWidth:        "85%",
                padding:         "14px 16px",
                fontSize:        "14px",
                lineHeight:      "1.6",
              }}
            >
              ¡Hola! Soy el{" "}
              <span style={{ color: "#1e4d9e", fontWeight: 600 }}>UABL Assistant</span>. Tengo
              acceso a los datos reales de {mesNombre} — viajes, ocupación, departamentos y
              lanchas. ¿Qué querés analizar hoy?
            </div>
          </div>
        )}

        {/* Message history */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              style={
                msg.role === "user"
                  ? {
                      backgroundColor: "#1e3f7a",
                      color:           "#dceeff",
                      borderRadius:    "14px 14px 2px 14px",
                      maxWidth:        "80%",
                      padding:         "12px 16px",
                      fontSize:        "14px",
                      lineHeight:      "1.6",
                    }
                  : {
                      backgroundColor: "#f8faff",
                      color:           "#1a2e50",
                      borderRadius:    "14px 14px 14px 2px",
                      border:          "1px solid rgba(200,220,248,0.4)",
                      maxWidth:        "85%",
                      padding:         "12px 16px",
                      fontSize:        "14px",
                      lineHeight:      "1.6",
                    }
              }
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p:      ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ color: "#1549a0", fontWeight: 500 }}>{children}</strong>,
                    ul:     ({ children }) => <ul style={{ paddingLeft: "16px", margin: "4px 0" }}>{children}</ul>,
                    ol:     ({ children }) => <ol style={{ paddingLeft: "16px", margin: "4px 0" }}>{children}</ol>,
                    li:     ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loadingChat && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}

        {/* Chat error */}
        {chatError && (
          <p style={{ color: "#f87171", fontSize: "13px" }} className="text-center">
            {chatError} — Intentá de nuevo.
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggestion pills ───────────────────────────────────────────────── */}
      <div className="px-5 pb-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => void sendMessage(s)}
            disabled={loadingChat}
            style={{
              border:          "1px solid rgba(255,255,255,0.1)",
              borderRadius:    "20px",
              backgroundColor: "rgba(255,255,255,0.04)",
              color:           "#90b8e0",
              fontSize:        "12px",
              padding:         "5px 13px",
              cursor:          loadingChat ? "not-allowed" : "pointer",
              opacity:         loadingChat ? 0.5 : 1,
              transition:      "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!loadingChat) {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.backgroundColor = "rgba(30,77,158,0.28)";
                el.style.color = "#c0d8f4";
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = "rgba(255,255,255,0.04)";
              el.style.color = "#90b8e0";
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Input row ──────────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex gap-3 items-end">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
          placeholder="Preguntá sobre los datos del período..."
          disabled={loadingChat}
          style={{
            flex:            1,
            minWidth:        0,
            backgroundColor: "#f8faff",
            color:           "#1a2e50",
            border:          "1px solid rgba(180,210,248,0.5)",
            borderRadius:    "10px",
            padding:         "13px 16px",
            fontSize:        "14px",
            outline:         "none",
          }}
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={loadingChat || !input.trim()}
          style={{
            backgroundColor: "#1e4d9e",
            color:           "white",
            border:          "none",
            borderRadius:    "10px",
            padding:         "13px 18px",
            fontSize:        "14px",
            fontWeight:      600,
            cursor:          loadingChat || !input.trim() ? "not-allowed" : "pointer",
            opacity:         loadingChat || !input.trim() ? 0.5 : 1,
            display:         "flex",
            alignItems:      "center",
            gap:             "6px",
            whiteSpace:      "nowrap",
            transition:      "background 0.15s, opacity 0.15s",
            flexShrink:      0,
          }}
          onMouseEnter={(e) => {
            if (!loadingChat && input.trim()) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2563bd";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1e4d9e";
          }}
        >
          {loadingChat ? (
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Send size={16} />
          )}
          Enviar
        </button>
      </div>

      {/* ── Recommendations section ────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#091222", borderTop: "1px solid rgba(255,255,255,0.05)" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 gap-3">
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "#f0f6ff", fontSize: "14px", fontWeight: 600 }}>
              Recomendaciones activas
            </p>
            {implementadasCount > 0 && (
              <p style={{ color: "#34d399", fontSize: "11px", marginTop: "3px" }}>
                {implementadasCount} implementada{implementadasCount !== 1 ? "s" : ""} este mes
              </p>
            )}
          </div>
          <button
            onClick={() => void generateRecs()}
            disabled={generatingRecs || loadingRecs}
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border:          "1px solid rgba(255,255,255,0.12)",
              borderRadius:    "8px",
              color:           "#90b8e0",
              fontSize:        "12px",
              fontWeight:      500,
              padding:         "7px 13px",
              cursor:          generatingRecs || loadingRecs ? "not-allowed" : "pointer",
              opacity:         generatingRecs || loadingRecs ? 0.5 : 1,
              display:         "flex",
              alignItems:      "center",
              gap:             "5px",
              transition:      "opacity 0.15s",
              flexShrink:      0,
              whiteSpace:      "nowrap",
            }}
          >
            {generatingRecs ? (
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <RefreshCw size={13} />
            )}
            Nuevo análisis
          </button>
        </div>

        {/* Error */}
        {recsError && (
          <p style={{ color: "#f87171", fontSize: "13px" }} className="px-5 pb-3 text-center">
            {recsError}
          </p>
        )}

        {/* Loading */}
        {(loadingRecs || generatingRecs) && (
          <div className="flex justify-center py-10">
            <div className="flex items-center gap-2" style={{ color: "#4d72a8" }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "13px" }}>
                {generatingRecs ? "Analizando datos con IA..." : "Cargando recomendaciones..."}
              </span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loadingRecs && !generatingRecs && activeRecs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <p style={{ color: "#4d72a8", fontSize: "13px" }}>
              No hay recomendaciones activas para este período.
            </p>
            <p style={{ color: "#3d5f8a", fontSize: "12px", marginTop: "5px" }}>
              Presioná "Nuevo análisis" para generar sugerencias con IA.
            </p>
          </div>
        )}

        {/* Recommendation cards — 1-col mobile / 3-col desktop */}
        {!loadingRecs && !generatingRecs && activeRecs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-5 pb-6">
            {activeRecs.map((rec) => (
              <div
                key={rec.id}
                style={{
                  backgroundColor: "#0d1b35",
                  border:          "1px solid rgba(255,255,255,0.07)",
                  borderTop:       `3px solid ${PRIORIDAD_BORDER[rec.prioridad]}`,
                  borderRadius:    "10px",
                  padding:         "14px",
                  display:         "flex",
                  flexDirection:   "column",
                  gap:             "10px",
                }}
              >
                {/* Priority badge */}
                <span
                  style={{
                    backgroundColor: PRIORIDAD_BADGE_BG[rec.prioridad],
                    color:           PRIORIDAD_BADGE_TEXT[rec.prioridad],
                    fontSize:        "10px",
                    fontWeight:      600,
                    padding:         "3px 9px",
                    borderRadius:    "20px",
                    alignSelf:       "flex-start",
                    letterSpacing:   "0.02em",
                  }}
                >
                  {PRIORIDAD_LABEL[rec.prioridad]}
                </span>

                {/* Title */}
                <p style={{ color: "#f0f6ff", fontSize: "13px", fontWeight: 600, lineHeight: "1.4" }}>
                  {rec.titulo}
                </p>

                {/* Description */}
                <p
                  style={{
                    color:      "#4d72a8",
                    fontSize:   "12px",
                    lineHeight: "1.55",
                    flexGrow:   1,
                  }}
                >
                  {rec.descripcion}
                </p>

                {/* Savings */}
                <p style={{ color: "#34d399", fontSize: "12px", fontWeight: 500 }}>
                  +{rec.ahorroEstimadoAsientos} asientos/mes
                </p>

                {/* Action buttons — side by side */}
                <div className="flex gap-2">
                  <ImplementarButton onConfirm={() => void updateEstado(rec.id, "IMPLEMENTADA")} />
                  <button
                    onClick={() => void updateEstado(rec.id, "DESCARTADA")}
                    style={{
                      flex:            1,
                      backgroundColor: "transparent",
                      border:          "1px solid rgba(255,255,255,0.14)",
                      borderRadius:    "7px",
                      color:           "#90b8e0",
                      fontSize:        "12px",
                      fontWeight:      500,
                      padding:         "7px 4px",
                      cursor:          "pointer",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      gap:             "5px",
                      transition:      "background 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.backgroundColor = "rgba(239,68,68,0.1)";
                      el.style.color = "#f87171";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.backgroundColor = "transparent";
                      el.style.color = "#90b8e0";
                    }}
                  >
                    <X size={12} />
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
