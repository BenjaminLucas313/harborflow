"use client";

// Onboarding wizard para usuarios EMPRESA sin employer asignado.
// Pasos: nombre de empresa → representante + teléfono → éxito.
// Al finalizar, crea el Employer vía POST /api/employers y actualiza
// el JWT con useSession().update() para que el middleware lo reconozca.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LineWavesBackground } from "@/components/ui/LineWavesBackground";
import { Building2, User, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Step indicator dots
// ---------------------------------------------------------------------------

function Dots({ step }: { step: Step }) {
  return (
    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
      {([1, 2] as const).map((s) => (
        <div
          key={s}
          style={{
            width:        "8px",
            height:       "8px",
            borderRadius: "50%",
            backgroundColor:
              step > s ? "#22c55e"      // completado → verde
              : step === s ? "#3b82f6"  // actual → azul
              : "rgba(255,255,255,0.2)",
            transition: "background-color 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input helper
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  value,
  onChange,
  required = false,
}: {
  label:    string;
  hint?:    string;
  value:    string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
        {label}{required && <span style={{ color: "#f87171", marginLeft: "3px" }}>*</span>}
      </label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background:   "rgba(255,255,255,0.08)",
          border:       "1px solid rgba(255,255,255,0.15)",
          borderRadius: "10px",
          padding:      "10px 14px",
          fontSize:     "14px",
          color:        "#fff",
          outline:      "none",
          width:        "100%",
          boxSizing:    "border-box",
        }}
      />
      {hint && (
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: 0 }}>{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router    = useRouter();
  const { update } = useSession();

  const [step,          setStep]          = useState<Step>(1);
  const [nombre,        setNombre]        = useState("");
  const [representante, setRepresentante] = useState("");
  const [telefono,      setTelefono]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // ── Step 2 submit: call API + update JWT ──────────────────────────────────

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/employers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: nombre, representante, telefono }),
      });

      const json = await res.json() as {
        data?: { id: string; name: string };
        error?: { message: string };
      };

      if (!res.ok) {
        setError(json.error?.message ?? "Error al crear la empresa.");
        return;
      }

      // Refresh JWT so middleware sees employerId and stops redirecting.
      await update({
        employerId:   json.data!.id,
        employerName: json.data!.name,
      });

      setStep(3);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // ── Shared card styles ────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background:     "rgba(255,255,255,0.07)",
    border:         "1px solid rgba(255,255,255,0.15)",
    borderRadius:   "20px",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    padding:        "32px 28px",
    width:          "100%",
    maxWidth:       "400px",
    display:        "flex",
    flexDirection:  "column",
    gap:            "24px",
  };

  const primaryBtn: React.CSSProperties = {
    background:   "#fff",
    color:        "#0a1628",
    border:       "none",
    borderRadius: "10px",
    padding:      "12px 20px",
    fontSize:     "14px",
    fontWeight:   700,
    cursor:       loading ? "not-allowed" : "pointer",
    opacity:      loading ? 0.7 : 1,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    gap:          "6px",
    transition:   "opacity 0.2s",
  };

  const secondaryBtn: React.CSSProperties = {
    background:   "rgba(255,255,255,0.1)",
    color:        "rgba(255,255,255,0.8)",
    border:       "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px",
    padding:      "12px 20px",
    fontSize:     "14px",
    fontWeight:   600,
    cursor:       "pointer",
    display:      "flex",
    alignItems:   "center",
    gap:          "6px",
    transition:   "opacity 0.2s",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        position:       "relative",
        minHeight:      "100svh",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "24px 16px",
        background:     "#020009",
      }}
    >
      {/* Overscroll fill */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "#020009", zIndex: -1 }} />

      {/* LineWaves background */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <LineWavesBackground
          speed={0.2}
          innerLineCount={32}
          outerLineCount={36}
          warpIntensity={1}
          rotation={-45}
          edgeFadeWidth={0}
          colorCycleSpeed={1}
          brightness={0.2}
          color1="#020009"
          color2="#01286d"
          color3="#367ed3"
          enableMouseInteraction={false}
          mouseInfluence={1}
        />
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", display: "flex", justifyContent: "center" }}>

        {/* ── STEP 1: Nombre de empresa ────────────────────────────────────── */}
        {step === 1 && (
          <div style={cardStyle}>
            <Dots step={1} />

            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "52px", height: "52px", borderRadius: "14px",
                background: "rgba(59,130,246,0.2)", marginBottom: "16px",
              }}>
                <Building2 size={26} color="#60a5fa" />
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
                ¡Bienvenido a HarborFlow!
              </h1>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>
                Empecemos configurando los datos de tu empresa. Solo te llevará un minuto.
              </p>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) setStep(2); }}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <Field
                label="Nombre de la empresa"
                value={nombre}
                onChange={setNombre}
                required
              />

              <button type="submit" style={primaryBtn} disabled={!nombre.trim()}>
                Continuar
                <ArrowRight size={15} />
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 2: Representante + teléfono ─────────────────────────────── */}
        {step === 2 && (
          <div style={cardStyle}>
            <Dots step={2} />

            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "52px", height: "52px", borderRadius: "14px",
                background: "rgba(234,179,8,0.2)", marginBottom: "16px",
              }}>
                <User size={26} color="#facc15" />
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
                Datos de contacto
              </h1>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5 }}>
                ¿Quién es el representante?
              </p>
            </div>

            <form onSubmit={handleFinish} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Field
                label="Nombre del representante"
                value={representante}
                onChange={setRepresentante}
                required
              />
              <Field
                label="Teléfono de contacto"
                hint="Celular o teléfono fijo"
                value={telefono}
                onChange={setTelefono}
                required
              />

              {error && (
                <p style={{
                  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "8px", padding: "10px 14px",
                  fontSize: "13px", color: "#fca5a5", margin: 0,
                }}>
                  {error}
                </p>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={secondaryBtn}
                  disabled={loading}
                >
                  <ArrowLeft size={15} />
                  Volver
                </button>
                <button
                  type="submit"
                  style={{ ...primaryBtn, flex: 1 }}
                  disabled={loading || !representante.trim() || !telefono.trim()}
                >
                  {loading ? "Creando…" : "Finalizar →"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3: Éxito ────────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ ...cardStyle, textAlign: "center", alignItems: "center" }}>
            <CheckCircle2 size={52} color="#22c55e" />

            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
                ¡Todo listo!
              </h1>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
                Ya podés reservar lugares para tu equipo.
              </p>
            </div>

            <button
              onClick={() => router.push("/empresa")}
              style={primaryBtn}
            >
              Ir al dashboard
              <ArrowRight size={15} />
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
