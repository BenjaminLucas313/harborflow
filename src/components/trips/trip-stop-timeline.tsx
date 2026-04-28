type Stop = { order: number; name: string };

type Props = {
  stops: Stop[];
  className?: string;
};

export function TripStopTimeline({ stops, className = "" }: Props) {
  if (stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.order - b.order);

  return (
    <div className={`rounded-xl border border-border bg-card p-4 space-y-0 ${className}`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Recorrido</p>
      {sorted.map((stop, idx) => {
        const isFirst = idx === 0;
        const isLast  = idx === sorted.length - 1;
        return (
          <div key={stop.order} className="flex gap-3">
            {/* Timeline column */}
            <div className="flex flex-col items-center w-4 shrink-0">
              <div
                className={`size-3 rounded-full shrink-0 mt-0.5 ${
                  isFirst ? "bg-emerald-500" : isLast ? "bg-blue-500" : "bg-muted-foreground/40"
                }`}
              />
              {!isLast && <div className="w-px flex-1 bg-border my-1 min-h-3" />}
            </div>
            {/* Label */}
            <div className="pb-3">
              <p className={`text-sm ${isFirst || isLast ? "font-medium" : "text-muted-foreground"}`}>
                {stop.name}
              </p>
              {isFirst && (
                <p className="text-xs text-muted-foreground">Salida</p>
              )}
              {isLast && (
                <p className="text-xs text-muted-foreground">Llegada</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
