"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Save, Eye, EyeOff, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Role colours (mirrors nav-user-menu.tsx)
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  UABL:      { bg: "#1a3560", text: "#7eb8f5" },
  EMPRESA:   { bg: "#1a3a20", text: "#4ade80" },
  PROVEEDOR: { bg: "#2d1a00", text: "#fb923c" },
  CONDUCTOR: { bg: "#1a1040", text: "#a78bfa" },
  USUARIO:   { bg: "#1a2a1a", text: "#86efac" },
};

const ROLE_LABELS: Record<string, string> = {
  UABL:      "UABL",
  EMPRESA:   "Empresa",
  PROVEEDOR: "Proveedor",
  CONDUCTOR: "Conductor",
  USUARIO:   "Usuario",
};

function getInitials(firstName: string, lastName: string): string {
  if (firstName && lastName) return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return "??";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type User = {
  firstName: string;
  lastName:  string;
  email:     string;
  role:      string;
};

type Tab = "info" | "password" | "apariencia";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PerfilClient({
  user,
  defaultTab,
}: {
  user: User;
  defaultTab: "info" | "password";
}) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <ProfileHeader user={user} />

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <TabNav active={activeTab} onChange={setActiveTab} />

      {/* ── Sections ────────────────────────────────────────────────────── */}
      {activeTab === "info"       && <InfoSection user={user} />}
      {activeTab === "password"   && <PasswordSection />}
      {activeTab === "apariencia" && <AppearanceSection />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Profile header
// ---------------------------------------------------------------------------

function ProfileHeader({ user }: { user: User }) {
  const colors = ROLE_COLORS[user.role] ?? { bg: "#1a3560", text: "#7eb8f5" };
  const initials = getInitials(user.firstName, user.lastName);
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="flex items-center gap-4 pb-2">
      <div
        aria-hidden="true"
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: colors.bg,
          color: colors.text,
          border: "2px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: "0.04em",
          userSelect: "none",
        }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight truncate">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{roleLabel}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: "info",       label: "Información"  },
  { id: "password",   label: "Contraseña"   },
  { id: "apariencia", label: "Apariencia"   },
];

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="flex gap-1 border-b border-border"
      aria-label="Secciones del perfil"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors",
              "bg-transparent cursor-pointer",
              // All border via longhands — no shorthand mixing
              "border-t-0 border-r-0 border-l-0 border-b-2 border-solid",
              isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Section: Información
// ---------------------------------------------------------------------------

function InfoSection({ user }: { user: User }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName,  setLastName]  = useState(user.lastName);
  const [loading,   setLoading]   = useState(false);
  const [feedback,  setFeedback]  = useState<{ type: "ok" | "error"; msg: string } | null>(null);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/perfil", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", msg: data.error ?? "Error al guardar" });
      } else {
        setFeedback({ type: "ok", msg: "Nombre actualizado correctamente" });
      }
    } catch {
      setFeedback({ type: "error", msg: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Información">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre" htmlFor="firstName">
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={60}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Apellido" htmlFor="lastName">
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={60}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>

        {feedback && (
          <p
            className="text-sm px-3 py-2 rounded-md"
            style={{
              background: feedback.type === "ok" ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)",
              color:      feedback.type === "ok" ? "#16a34a"               : "#dc2626",
            }}
          >
            {feedback.msg}
          </p>
        )}

        <div className="flex justify-end">
          <SubmitButton loading={loading} label="Guardar cambios" />
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: Contraseña
// ---------------------------------------------------------------------------

function PasswordSection() {
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext,    setShowNext]    = useState(false);

  const mismatch    = confirm.length > 0 && next !== confirm;
  const sameAsCurrent = next.length > 0 && next === current;

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (mismatch || sameAsCurrent) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/perfil/password", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json();

      if (!res.ok) {
        const fieldError =
          data.details?.currentPassword?.[0] ??
          data.details?.newPassword?.[0] ??
          data.details?.confirmPassword?.[0] ??
          data.error ??
          "Error al cambiar contraseña";
        setFeedback({ type: "error", msg: fieldError });
      } else {
        setFeedback({ type: "ok", msg: "Contraseña actualizada correctamente" });
        setCurrent(""); setNext(""); setConfirm("");
      }
    } catch {
      setFeedback({ type: "error", msg: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Contraseña">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Contraseña actual" htmlFor="currentPwd">
          <PasswordInput
            id="currentPwd"
            value={current}
            onChange={setCurrent}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />
        </Field>

        <Field
          label="Nueva contraseña"
          htmlFor="newPwd"
          error={sameAsCurrent ? "Debe ser diferente a la contraseña actual" : undefined}
        >
          <PasswordInput
            id="newPwd"
            value={next}
            onChange={setNext}
            show={showNext}
            onToggle={() => setShowNext((v) => !v)}
            autoComplete="new-password"
            minLength={8}
          />
        </Field>

        <Field
          label="Confirmar nueva contraseña"
          htmlFor="confirmPwd"
          error={mismatch ? "Las contraseñas no coinciden" : undefined}
        >
          <PasswordInput
            id="confirmPwd"
            value={confirm}
            onChange={setConfirm}
            show={showNext}
            onToggle={() => setShowNext((v) => !v)}
            autoComplete="new-password"
          />
        </Field>

        {feedback && (
          <p
            className="text-sm px-3 py-2 rounded-md"
            style={{
              background: feedback.type === "ok" ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)",
              color:      feedback.type === "ok" ? "#16a34a"               : "#dc2626",
            }}
          >
            {feedback.msg}
          </p>
        )}

        <div className="flex justify-end">
          <SubmitButton loading={loading} label="Cambiar contraseña" disabled={mismatch || sameAsCurrent} />
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section: Apariencia (theme toggle)
// ---------------------------------------------------------------------------

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <SectionCard title="Apariencia">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Tema de la interfaz</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isDark ? "Modo oscuro activo" : "Modo claro activo"}
          </p>
        </div>

        {/* 120px animated toggle */}
        <button
          role="switch"
          aria-checked={isDark}
          aria-label="Cambiar tema"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          style={{
            width:           "120px",
            height:          "36px",
            borderRadius:    "18px",
            border:          "1.5px solid var(--border)",
            backgroundColor: isDark ? "#1a1040" : "#f0f6ff",
            position:        "relative",
            cursor:          "pointer",
            flexShrink:      0,
            transition:      "background-color 0.3s ease",
            padding:         0,
          }}
        >
          {/* Sun label */}
          <span
            style={{
              position:   "absolute",
              left:       "12px",
              top:        "50%",
              transform:  "translateY(-50%)",
              fontSize:   "12px",
              fontWeight: 600,
              color:      isDark ? "rgba(255,255,255,0.25)" : "#92400e",
              display:    "flex",
              alignItems: "center",
              gap:        "3px",
              transition: "color 0.3s ease",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            <Sun size={13} aria-hidden="true" />
          </span>

          {/* Moon label */}
          <span
            style={{
              position:   "absolute",
              right:      "12px",
              top:        "50%",
              transform:  "translateY(-50%)",
              fontSize:   "12px",
              fontWeight: 600,
              color:      isDark ? "#a78bfa" : "rgba(0,0,0,0.2)",
              display:    "flex",
              alignItems: "center",
              gap:        "3px",
              transition: "color 0.3s ease",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            <Moon size={13} aria-hidden="true" />
          </span>

          {/* Sliding pill */}
          <span
            aria-hidden="true"
            style={{
              position:        "absolute",
              top:             "3px",
              left:            isDark ? "calc(100% - 57px - 3px)" : "3px",
              width:           "57px",
              height:          "28px",
              borderRadius:    "14px",
              backgroundColor: isDark ? "#7c3aed" : "#ffffff",
              boxShadow:       "0 1px 4px rgba(0,0,0,0.18)",
              transition:      "left 0.25s ease-in-out, background-color 0.3s ease",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              fontSize:        "11px",
              fontWeight:      700,
              color:           isDark ? "#f0f6ff" : "#1e293b",
            }}
          >
            {isDark ? <Moon size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />}
          </span>
        </button>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border border-border bg-card p-5 space-y-4"
      aria-labelledby={`section-${title}`}
    >
      <h2 id={`section-${title}`} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  minLength,
}: {
  id:           string;
  value:        string;
  onChange:     (v: string) => void;
  show:         boolean;
  onToggle:     () => void;
  autoComplete: string;
  minLength?:   number;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

function SubmitButton({
  loading,
  label,
  disabled,
}: {
  loading:   boolean;
  label:     string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        <Save size={15} aria-hidden="true" />
      )}
      {loading ? "Guardando…" : label}
    </button>
  );
}
