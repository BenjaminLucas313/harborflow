// =============================================================================
// export.ts — Client-side CSV export utility
// =============================================================================
//
// exportToCSV: Serializes an array of plain objects to CSV and triggers a
// browser file download. All string values are properly escaped.
//
// Usage:
//   exportToCSV(metrics.resumenPorDepto, `metricas-${mes}-${anio}`, {
//     "departamentoNombre": "Departamento",
//     "asientosConfirmados": "Confirmados",
//   });
//
// Runs exclusively in the browser — do not call from server components.
// =============================================================================

/** Escape a single CSV field value. */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? String(value) : String(value);
  // Wrap in quotes if the value contains a comma, double-quote, or newline.
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Downloads an array of objects as a CSV file in the browser.
 *
 * @param data     Array of plain objects (all rows must have the same keys).
 * @param filename Desired file name without extension (`.csv` is appended).
 * @param labels   Optional map from object key → column header label.
 *                 If omitted, raw object keys are used as headers.
 */
export function exportToCSV(
  data:      Record<string, unknown>[],
  filename:  string,
  labels?:   Record<string, string>,
): void {
  if (data.length === 0) return;

  const first = data[0];
  if (!first) return;
  const keys = Object.keys(first);
  const headers = keys.map((k) => escapeCsvField(labels?.[k] ?? k));

  const rows = data.map((row) =>
    keys.map((k) => escapeCsvField(row[k])).join(","),
  );

  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href     = url;
  a.download = `${filename}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
