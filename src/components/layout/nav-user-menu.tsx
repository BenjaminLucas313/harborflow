"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { User, KeyRound, LogOut } from "lucide-react";

// ---------------------------------------------------------------------------
// Role colour palette (Change 3 — dynamic avatar colours)
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
// Burger bar styles — absolute positioning approach
//
// Button is 16×16px, position:relative.
// Bars are position:absolute, width:100%, height:2px.
// Closed positions: top 1px / 7px / 13px (evenly spaced).
// Open: bar1 and bar3 both move to top:7px (same as bar2) → transform-origin
// of each bar lands on the same pivot (8px, 8px) → clean X cross.
// ---------------------------------------------------------------------------

function barStyle(index: 1 | 2 | 3, open: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position:        "absolute",
    left:            0,
    width:           "100%",
    height:          "2px",
    backgroundColor: "#335b75",
    borderRadius:    "2px",
    transformOrigin: "center",
  };

  if (index === 1) return {
    ...base,
    top:        open ? "7px" : "1px",
    transform:  open ? "rotate(45deg)"  : "none",
    transition: "top 0.25s ease-in-out, transform 0.25s ease-in-out",
  };
  if (index === 2) return {
    ...base,
    top:        "7px",
    opacity:    open ? 0 : 1,
    transition: "opacity 0.25s ease-in-out",
  };
  return {
    ...base,
    top:        open ? "7px" : "13px",
    transform:  open ? "rotate(-45deg)" : "none",
    transition: "top 0.25s ease-in-out, transform 0.25s ease-in-out",
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  firstName:  string;
  lastName:   string;
  role:       string;
  /** When provided, overrides the default /perfil href for the "Mi perfil" menu item. */
  perfilHref?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NavUserMenu({ firstName, lastName, role, perfilHref }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const colors    = ROLE_COLORS[role] ?? { bg: "#1a3560", text: "#7eb8f5" };
  const initials  = getInitials(firstName, lastName);
  const roleLabel = ROLE_LABELS[role] ?? role;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>

      {/* ── Trigger row ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

        {/* Avatar */}
        <div
          aria-hidden="true"
          style={{
            width:           "30px",
            height:          "30px",
            borderRadius:    "50%",
            backgroundColor: colors.bg,
            color:           colors.text,
            border:          "1.5px solid rgba(255,255,255,0.15)",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        "11px",
            fontWeight:      700,
            flexShrink:      0,
            letterSpacing:   "0.04em",
            userSelect:      "none",
          }}
        >
          {initials}
        </div>

        {/* Name + role */}
        <div className="hidden sm:block" style={{ lineHeight: 1, minWidth: 0 }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#335b75", margin: 0, whiteSpace: "nowrap" }}>
            {firstName} {lastName}
          </p>
          <p style={{ fontSize: "10px", color: "var(--muted-foreground)", margin: "3px 0 0", whiteSpace: "nowrap" }}>
            {roleLabel}
          </p>
        </div>

        {/* Vertical separator */}
        <div
          aria-hidden="true"
          className="hidden sm:block"
          style={{ width: "1px", height: "22px", backgroundColor: "var(--border)", flexShrink: 0 }}
        />

        {/* Burger button */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú de usuario" : "Abrir menú de usuario"}
          aria-expanded={open}
          aria-haspopup="menu"
          style={{
            position:   "relative",
            background: "none",
            border:     "none",
            cursor:     "pointer",
            padding:    0,
            width:      "16px",
            height:     "16px",
            flexShrink: 0,
          }}
        >
          <span style={barStyle(1, open)} />
          <span style={barStyle(2, open)} />
          <span style={barStyle(3, open)} />
        </button>
      </div>

      {/* ── Dropdown — keyframes live in globals.css (navDropIn) ─────────── */}
      {open && (
        <div
          role="menu"
          style={{
            position:        "absolute",
            top:             "calc(100% + 10px)",
            right:           0,
            backgroundColor: "var(--card)",
            border:          "0.5px solid var(--border)",
            borderRadius:    "var(--radius)",
            width:           "210px",
            zIndex:          50,
            overflow:        "hidden",
            boxShadow:       "0 4px 16px rgba(0,0,0,0.10)",
            animation:       "navDropIn 180ms ease-out forwards",
          }}
        >
          <DropItem
            href={perfilHref ?? "/perfil"}
            icon={<User size={15} aria-hidden="true" />}
            onClose={() => setOpen(false)}
          >
            Mi perfil
          </DropItem>

          <DropItem
            href="/perfil?tab=password"
            icon={<KeyRound size={15} aria-hidden="true" />}
            onClose={() => setOpen(false)}
          >
            Cambiar contraseña
          </DropItem>

          <button
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await signOut({ callbackUrl: "/login" });
            }}
            style={dropItemStyle(true)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <LogOut size={15} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dropItemStyle(isDestructive = false): React.CSSProperties {
  return {
    display:             "flex",
    alignItems:          "center",
    gap:                 "10px",
    padding:             "10px 14px",
    fontSize:            "13px",
    color:               isDestructive ? "#ef4444" : "var(--foreground)",
    textDecoration:      "none",
    backgroundColor:     "transparent",
    cursor:              "pointer",
    width:               "100%",
    border:              "none",
    borderBottomWidth:   "1px",
    borderBottomStyle:   "solid",
    borderBottomColor:   "var(--border)",
    transition:          "background-color 0.15s",
    textAlign:           "left",
  };
}

function DropItem({
  href,
  icon,
  children,
  onClose,
}: {
  href:     string;
  icon:     React.ReactNode;
  children: React.ReactNode;
  onClose:  () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClose}
      style={dropItemStyle()}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {icon}
      {children}
    </Link>
  );
}
