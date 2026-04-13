"use client";

// ViajesGrouped — collapsible sections of trips grouped by calendar day.
//
// Receives pre-sorted próximos (ascending) and pasados (descending) trip arrays
// from the server. Groups each array by Argentina-local date and renders
// DayDivider separators between day groups.
//
// Collapsible sections use a CSS grid-rows trick for smooth height animation
// that respects prefers-reduced-motion automatically via Tailwind's motion-safe:.

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { DayDivider } from "@/components/ui/DayDivider";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TripItem = {
  id:            string;
  departureTime: Date | string;
  status:        string;
  capacity:      number;
  occupancy:     number;   // pre-computed slot count passed from server
  boatName:      string;
  branchName:    string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  BOARDING:  "Embarcando",
  DELAYED:   "Demorado",
  CANCELLED: "Cancelado",
  DEPARTED:  "Partido",
  COMPLETED: "Completado",
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  BOARDING:  "bg-amber-100 text-amber-700",
  DELAYED:   "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-600",
  DEPARTED:  "bg-slate-100 text-slate-600",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

const ARG_TZ = "America/Argentina/Buenos_Aires";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArgDateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ARG_TZ }).format(
    new Date(date),
  );
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("es-AR", {
    timeZone: ARG_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Groups a sorted array of trips by Argentina calendar date.
function groupByDay(trips: TripItem[]): [string, TripItem[]][] {
  const map = new Map<string, TripItem[]>();
  for (const t of trips) {
    const key = toArgDateKey(t.departureTime);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries());
}

// ---------------------------------------------------------------------------
// Single collapsible section
// ---------------------------------------------------------------------------

type SectionProps = {
  title:        string;
  count:        number;
  defaultOpen:  boolean;
  children:     React.ReactNode;
};

function CollapsibleSection({ title, count, defaultOpen, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      {/* Section header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-2 text-left group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            "motion-safe:transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden="true"
        />
      </button>

      {/* Animated content — CSS grid-rows trick */}
      <div
        className={cn(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-2 space-y-1">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trip card row
// ---------------------------------------------------------------------------

function TripRow({ trip }: { trip: TripItem }) {
  const time = formatTime(trip.departureTime);

  return (
    <Link
      href={`/proveedor/viajes/${trip.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-sm transition-shadow"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{trip.boatName}</p>
        <p className="text-xs text-muted-foreground">
          {time} · {trip.branchName}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-muted-foreground tabular-nums">
          {trip.occupancy}/{trip.capacity}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_COLOR[trip.status] ?? "bg-slate-100 text-slate-600",
          )}
        >
          {STATUS_LABEL[trip.status] ?? trip.status}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

type Props = {
  proximos: TripItem[];
  pasados:  TripItem[];
};

export function ViajesGrouped({ proximos, pasados }: Props) {
  if (proximos.length === 0 && pasados.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No hay viajes registrados.
      </div>
    );
  }

  const proximosByDay = groupByDay(proximos);
  const pasadosByDay  = groupByDay(pasados);

  return (
    <div className="space-y-6">
      {/* ── Próximos ───────────────────────────────────────────────────────── */}
      {proximosByDay.length > 0 && (
        <CollapsibleSection
          title="Próximos"
          count={proximos.length}
          defaultOpen={true}
        >
          {proximosByDay.map(([dateKey, dayTrips], i) => (
            <div key={dateKey}>
              {/* Day divider before each group except if it's the very first */}
              {i > 0 && <DayDivider dateStr={dateKey} />}
              {i === 0 && <DayDivider dateStr={dateKey} />}
              {dayTrips.map((t) => (
                <TripRow key={t.id} trip={t} />
              ))}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* ── Separator between sections ───────────────────────────────────── */}
      {proximosByDay.length > 0 && pasadosByDay.length > 0 && (
        <div className="h-px bg-border" />
      )}

      {/* ── Pasados ────────────────────────────────────────────────────────── */}
      {pasadosByDay.length > 0 && (
        <CollapsibleSection
          title="Pasados"
          count={pasados.length}
          defaultOpen={false}
        >
          {pasadosByDay.map(([dateKey, dayTrips]) => (
            <div key={dateKey}>
              <DayDivider dateStr={dateKey} />
              {dayTrips.map((t) => (
                <TripRow key={t.id} trip={t} />
              ))}
            </div>
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}
