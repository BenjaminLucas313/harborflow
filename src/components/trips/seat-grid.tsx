// SeatGrid — visual occupancy reference for a trip.
//
// Renders one dot per seat. Dots are coloured by status:
//   confirmed → emerald
//   pending   → blue
//   free      → gray outline
//
// Additive only — does not replace any button or workflow.
// Server-renderable (no client state needed).

type Props = {
  capacity:  number;
  confirmed: number;
  pending:   number;
  /** Optional class applied to the root element. */
  className?: string;
};

export function SeatGrid({ capacity, confirmed, pending, className = "" }: Props) {
  // Clamp values so rendering is always safe even with stale data.
  const cap  = Math.max(0, capacity);
  const conf = Math.min(confirmed, cap);
  const pend = Math.min(pending,   cap - conf);
  const free = cap - conf - pend;

  if (cap === 0) return null;

  type Seat = "confirmed" | "pending" | "free";
  const seats: Seat[] = [
    ...Array<Seat>(conf).fill("confirmed"),
    ...Array<Seat>(pend).fill("pending"),
    ...Array<Seat>(free).fill("free"),
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${conf} confirmados, ${pend} pendientes, ${free} libres de ${cap} asientos`}>
        {seats.map((status, i) => (
          <span
            key={i}
            className={
              status === "confirmed"
                ? "size-4 rounded-full bg-emerald-500"
                : status === "pending"
                ? "size-4 rounded-full bg-blue-400"
                : "size-4 rounded-full border-2 border-muted-foreground/25"
            }
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {conf > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500 shrink-0" />
            {conf} confirmado{conf !== 1 ? "s" : ""}
          </span>
        )}
        {pend > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blue-400 shrink-0" />
            {pend} pendiente{pend !== 1 ? "s" : ""}
          </span>
        )}
        {free > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-muted-foreground/25 shrink-0" />
            {free} libre{free !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
