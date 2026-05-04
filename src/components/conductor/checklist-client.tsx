"use client";

// ChecklistClient — real-time boarding checklist for the assigned conductor.
// Receives initial state from the server component and handles:
//   - Optimistic checkbox toggle via PATCH /api/conductor/checkin
//   - Live "X / Y presentes" counter
//   - Departure confirmation via POST /api/conductor/confirmar-salida
//   - Offline persistence: unsynced check-ins survive page close via IndexedDB

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Loader2, Users, WifiOff } from "lucide-react";

// ---------------------------------------------------------------------------
// IndexedDB helpers — durable offline storage for unsynced check-ins
// ---------------------------------------------------------------------------

const IDB_NAME    = "harborflow-conductor";
const IDB_VERSION = 1;
const IDB_STORE   = "checkins";

type IDBCheckin = {
  tripId:    string;
  userId:    string;
  presente:  boolean;
  timestamp: number;
  synced:    boolean;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: ["tripId", "userId"] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveCheckInLocally(tripId: string, userId: string, presente: boolean): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const req   = store.put({ tripId, userId, presente, timestamp: Date.now(), synced: false });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // IDB unavailable (private mode, etc.) — silent fallback to in-memory queue
  }
}

async function markSyncedInDB(tripId: string, userId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx      = db.transaction(IDB_STORE, "readwrite");
      const store   = tx.objectStore(IDB_STORE);
      const getReq  = store.get([tripId, userId]);
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result as IDBCheckin, synced: true });
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  } catch { /* silent */ }
}

async function getPendingFromDB(tripId: string): Promise<IDBCheckin[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx    = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const all: IDBCheckin[] = [];
      const cursor = store.openCursor();
      cursor.onsuccess = (e) => {
        const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          const rec = c.value as IDBCheckin;
          if (rec.tripId === tripId && !rec.synced) all.push(rec);
          c.continue();
        } else {
          resolve(all);
        }
      };
      cursor.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PassengerRow {
  userId:     string;
  firstName:  string;
  lastName:   string;
  department: string | null;
}

interface Props {
  tripId:             string;
  passengers:         PassengerRow[];
  initialCheckins:    Record<string, boolean>; // userId → presente
  salidaConfirmada:   boolean;
  salidaConfirmadaAt: string | null;           // ISO string
  capacity:           number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChecklistClient({
  tripId,
  passengers,
  initialCheckins,
  salidaConfirmada: initialConfirmada,
  salidaConfirmadaAt: initialConfirmadaAt,
  capacity,
}: Props) {
  const [checkins,    setCheckins]    = useState<Record<string, boolean>>(initialCheckins);
  const [loadingIds,  setLoadingIds]  = useState<Set<string>>(new Set());
  const [confirming,  setConfirming]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [confirmed,   setConfirmed]   = useState(initialConfirmada);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initialConfirmadaAt);
  const [error,       setError]       = useState<string | null>(null);
  const [isOnline,    setIsOnline]    = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  // Queued mutations that failed due to network loss — flushed on reconnect.
  const pendingRef = useRef<Map<string, boolean>>(new Map());

  // On mount: sync any unsynced IDB records from a previous session.
  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    getPendingFromDB(tripId).then((pending) => {
      for (const rec of pending) {
        fetch("/api/conductor/checkin", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ tripId: rec.tripId, userId: rec.userId, presente: rec.presente }),
        })
          .then((res) => { if (res.ok) markSyncedInDB(rec.tripId, rec.userId).catch(() => {}); })
          .catch(() => { /* will retry on next mount or reconnect */ });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    const flushAll = () => {
      setIsOnline(true);
      // Flush in-memory queue (same session, fast path)
      pendingRef.current.forEach((presente, userId) => {
        fetch("/api/conductor/checkin", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ tripId, userId, presente }),
        })
          .then((res) => {
            if (res.ok) {
              pendingRef.current.delete(userId);
              markSyncedInDB(tripId, userId).catch(() => {});
            }
          })
          .catch(() => { /* stays queued for next reconnect */ });
      });
      // Also flush IDB records (cross-session, previous page loads)
      getPendingFromDB(tripId).then((pending) => {
        for (const rec of pending) {
          if (pendingRef.current.has(rec.userId)) continue; // already handled above
          fetch("/api/conductor/checkin", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ tripId: rec.tripId, userId: rec.userId, presente: rec.presente }),
          })
            .then((res) => { if (res.ok) markSyncedInDB(rec.tripId, rec.userId).catch(() => {}); })
            .catch(() => {});
        }
      }).catch(() => {});
    };
    const off = () => setIsOnline(false);
    window.addEventListener("online",  flushAll);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  flushAll);
      window.removeEventListener("offline", off);
    };
  }, [tripId]);

  const presentCount = Object.values(checkins).filter(Boolean).length;
  const total        = passengers.length;
  const allPresent   = presentCount === total && total > 0;

  // ---------------------------------------------------------------------------
  // Toggle check-in
  // ---------------------------------------------------------------------------

  async function handleToggle(userId: string) {
    if (confirmed) return;

    const prev = checkins[userId] ?? false;
    const next = !prev;

    // Optimistic update — always applied immediately
    setCheckins((c) => ({ ...c, [userId]: next }));

    if (!isOnline) {
      // Queue for sync on reconnect; no spinner needed
      pendingRef.current.set(userId, next);
      return;
    }

    setLoadingIds((s) => new Set(s).add(userId));
    try {
      const res = await fetch("/api/conductor/checkin", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tripId, userId, presente: next }),
      });
      if (!res.ok) {
        // Server rejected — revert
        setCheckins((c) => ({ ...c, [userId]: prev }));
        const json = await res.json().catch(() => ({})) as { error?: { message: string } };
        setError(json.error?.message ?? "Error al actualizar presencia.");
      } else {
        setError(null);
        pendingRef.current.delete(userId);
      }
    } catch {
      // Network failure while nominally online — keep optimistic state, queue sync
      pendingRef.current.set(userId, next);
    } finally {
      setLoadingIds((s) => { const n = new Set(s); n.delete(userId); return n; });
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm departure
  // ---------------------------------------------------------------------------

  async function handleConfirmar() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/conductor/confirmar-salida", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tripId }),
      });
      const json = await res.json() as { data?: { salidaConfirmadaAt?: string }; error?: { message: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Error al confirmar salida.");
      } else {
        setConfirmed(true);
        setConfirmedAt(json.data?.salidaConfirmadaAt ?? new Date().toISOString());
        setConfirming(false);
      }
    } catch {
      setError("Error de red al confirmar salida.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    });
  }

  return (
    <div className="space-y-4">

      {/* ── Offline banner ───────────────────────────────────────────── */}
      {!isOnline && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <WifiOff className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-800">
            Sin conexión — los cambios se guardarán cuando vuelva la señal.
          </p>
        </div>
      )}

      {/* ── Live counter ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          Pasajeros presentes
        </div>
        <span
          className={`text-xl font-bold tabular-nums ${
            allPresent ? "text-emerald-600" : presentCount > 0 ? "text-amber-600" : "text-muted-foreground"
          }`}
        >
          {presentCount}
          <span className="text-base font-normal text-muted-foreground"> / {total}</span>
        </span>
      </div>

      {/* ── Passenger list ───────────────────────────────────────────── */}
      {passengers.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl">
          No hay pasajeros confirmados en este viaje.
        </div>
      ) : (
        <ul className="space-y-2">
          {passengers.map((p) => {
            const presente = checkins[p.userId] ?? false;
            const loading  = loadingIds.has(p.userId);
            const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

            return (
              <li key={p.userId}>
                <button
                  type="button"
                  onClick={() => handleToggle(p.userId)}
                  disabled={loading || confirmed}
                  className={`
                    w-full flex items-center gap-3 rounded-xl border px-4 py-3.5
                    text-left transition-colors active:scale-[0.99]
                    disabled:opacity-60
                    ${presente
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-border bg-card hover:bg-muted/40"
                    }
                  `}
                  aria-pressed={presente}
                  aria-label={`${p.firstName} ${p.lastName} — ${presente ? "presente" : "pendiente"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`size-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      presente ? "bg-emerald-200 text-emerald-800" : "bg-muted text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>

                  {/* Name + dept */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight">
                      {p.firstName} {p.lastName}
                    </p>
                    {p.department && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.department}</p>
                    )}
                  </div>

                  {/* State icon */}
                  <div className="shrink-0">
                    {loading ? (
                      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                    ) : presente ? (
                      <CheckCircle2 className="size-6 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Circle className="size-6 text-muted-foreground/40" aria-hidden="true" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* ── Departure confirmation ───────────────────────────────────── */}
      {confirmed ? (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4 text-center space-y-1">
          <CheckCircle2 className="mx-auto size-8 text-emerald-500" aria-hidden="true" />
          <p className="font-bold text-emerald-800">Salida confirmada</p>
          {confirmedAt && (
            <p className="text-sm text-emerald-700">
              {presentCount} / {capacity} pasajeros · {fmtTime(confirmedAt)}
            </p>
          )}
        </div>
      ) : presentCount > 0 ? (
        confirming ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-center font-semibold text-amber-900">
              ¿Confirmar salida con {presentCount} / {capacity} pasajeros?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-border bg-background py-3 text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting
                  ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  : null
                }
                {submitting ? "Confirmando…" : "Sí, partir"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`
              w-full rounded-2xl py-4 text-base font-bold text-white transition
              active:scale-[0.98]
              ${allPresent
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-amber-500 hover:bg-amber-600"
              }
            `}
          >
            {allPresent
              ? `✓ Todos abordaron — Confirmar salida`
              : `Partir con ${presentCount} / ${capacity}`
            }
          </button>
        )
      ) : null}
    </div>
  );
}
