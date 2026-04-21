// DayDivider — visual date separator between groups of trips.
//
// Renders:  ——  13 de abril  ——
// Design:   thin horizontal rule on both sides of the date label.
// Motion:   no animation — this is a static structural element.
//
// Usage:
//   <DayDivider dateStr="2026-04-13" />
//   <DayDivider label="Hoy" />  (override label directly)

type Props = {
  /** YYYY-MM-DD date string (Argentina local date). Ignored when `label` is set. */
  dateStr?: string;
  /** Override the rendered text. Use for "Hoy", "Ayer", section titles, etc. */
  label?: string;
};

function formatDayLabel(dateStr: string): string {
  // Parse as noon local time to avoid any timezone-boundary edge cases.
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("es-AR", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });
}

export function DayDivider({ dateStr, label }: Props) {
  const text = label ?? (dateStr ? formatDayLabel(dateStr) : "");

  return (
    <div
      role="separator"
      aria-label={text}
      className="flex items-center gap-3 py-3 select-none"
    >
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap tracking-wide">
        {text}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
