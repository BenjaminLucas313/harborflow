"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Avatar colours — mirror NavUserMenu's CONDUCTOR palette
// ---------------------------------------------------------------------------

const AVATAR_BG   = "#1a1040";
const AVATAR_TEXT = "#a78bfa";

function getInitials(firstName: string, lastName: string): string {
  return ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  initialFirstName: string;
  initialLastName:  string;
  email:            string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerfilConductorForm({ initialFirstName, initialLastName, email }: Props) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName,  setLastName]  = useState(initialLastName);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const initials   = getInitials(firstName || initialFirstName, lastName || initialLastName);
  const fullName   = `${firstName} ${lastName}`.trim();

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/conductor/perfil", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ firstName, lastName }),
      });
      const json = await res.json() as { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Error al guardar.");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6 space-y-6">

      {/* ── Header mobile ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/conductor"
          className="flex items-center justify-center size-8 rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Mi perfil</h1>
      </div>

      {/* ── Avatar + identidad ────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div
          aria-hidden="true"
          style={{
            width:           "52px",
            height:          "52px",
            borderRadius:    "50%",
            backgroundColor: AVATAR_BG,
            color:           AVATAR_TEXT,
            border:          "2px solid rgba(255,255,255,0.12)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        "18px",
            fontWeight:      700,
            letterSpacing:   "0.04em",
            userSelect:      "none",
          }}
        >
          {initials}
        </div>
        <div className="text-center">
          <p className="font-semibold text-base">{fullName || "—"}</p>
          <span className="mt-1 inline-block rounded-full bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Conductor
          </span>
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Información personal
        </h2>

        <div className="space-y-1">
          <label htmlFor="firstName" className="text-sm font-medium">Nombre</label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="lastName" className="text-sm font-medium">Apellido</label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email <span className="text-muted-foreground font-normal">(solo lectura)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="w-full rounded-xl border border-input bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
            ✓ Perfil actualizado
          </div>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={saving || (!firstName.trim() || !lastName.trim())}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

    </div>
  );
}
