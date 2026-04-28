type Stop = { order: number; name: string };

/**
 * Derives a human-readable route string from an ordered list of TripStops.
 * Returns "Ruta no especificada" for trips without stops (backward-compatible).
 */
export function getTripRoute(stops: Stop[]): string {
  if (!stops || stops.length === 0) return "Ruta no especificada";
  const sorted = [...stops].sort((a, b) => a.order - b.order);
  if (sorted.length === 1) return sorted[0]!.name;
  const first = sorted[0]!.name;
  const last  = sorted[sorted.length - 1]!.name;
  const intermediates = sorted.length - 2;
  if (intermediates === 0) return `${first} → ${last}`;
  return `${first} → +${intermediates} parada${intermediates > 1 ? "s" : ""} → ${last}`;
}
