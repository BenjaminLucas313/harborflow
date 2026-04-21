"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

type Notificacion = {
  id:        string;
  titulo:    string;
  mensaje:   string;
  leida:     boolean;
  accionUrl: string | null;
  createdAt: string;
};

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24)  return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

export function NotificacionesBell() {
  const [open, setOpen]             = useState(false);
  const [items, setItems]           = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas]     = useState(0);
  const [bellShaking, setBellShaking]   = useState(false);
  const [badgeBouncing, setBadgeBouncing] = useState(false);
  const ref                         = useRef<HTMLDivElement>(null);
  const prevCountRef                = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones");
      if (!res.ok) return;
      const json = (await res.json()) as {
        data: { notificaciones: Notificacion[]; noLeidas: number };
      };
      setItems(json.data.notificaciones);
      setNoLeidas(json.data.noLeidas);
    } catch {
      // network error — silently ignore
    }
  }, []);

  // Initial fetch + 30-second polling
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Animate bell + badge when unread count increases
  useEffect(() => {
    if (noLeidas > prevCountRef.current) {
      setBellShaking(true);
      setBadgeBouncing(true);
      setTimeout(() => setBellShaking(false), 500);
      setTimeout(() => setBadgeBouncing(false), 400);
    }
    prevCountRef.current = noLeidas;
  }, [noLeidas]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function marcarTodas() {
    try {
      await fetch("/api/notificaciones/todas", { method: "PATCH" });
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
    } catch {
      // ignore
    }
  }

  async function handleItemClick(n: Notificacion) {
    if (!n.leida) {
      try {
        await fetch(`/api/notificaciones/${n.id}`, { method: "PATCH" });
        setItems((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, leida: true } : item)),
        );
        setNoLeidas((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (n.accionUrl) window.location.href = n.accionUrl;
  }

  const badgeText =
    noLeidas === 0 ? null : noLeidas >= 9 ? "9+" : String(noLeidas);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={
          noLeidas > 0
            ? `${noLeidas} notificaciones sin leer`
            : "Notificaciones"
        }
        className={`relative flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors${bellShaking ? " bell-shake" : ""}`}
      >
        <Bell className="size-4" aria-hidden="true" />
        {badgeText && (
          <span
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-0.75 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none pointer-events-none${badgeBouncing ? " badge-bounce" : ""}`}
            aria-hidden="true"
          >
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin notificaciones
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                      !n.leida ? "bg-accent/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-sm leading-snug ${
                          !n.leida ? "font-semibold" : ""
                        }`}
                      >
                        {n.titulo}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground mt-px">
                        {tiempoRelativo(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 text-left">
                      {n.mensaje}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
