// =============================================================================
// Script: generar-ejemplo-usuarios
// =============================================================================
//
// Genera docs/usuarios-ejemplo.xlsx con filas de ejemplo para cargar-usuarios-excel.
//
// Uso:
//   npx tsx src/scripts/generar-ejemplo-usuarios.ts
// =============================================================================

import * as XLSX from "xlsx";
import * as path from "path";
import * as fs   from "fs";

const rows = [
  ["nombre", "apellido", "email",                    "rol",      "departamento"],
  ["Juan",   "Pérez",    "juan.perez@ejemplo.com",   "USUARIO",  "Operaciones"],
  ["María",  "García",   "maria.garcia@ejemplo.com", "UABL",     "Mantenimiento"],
  ["Carlos", "López",    "carlos.lopez@ejemplo.com", "PROVEEDOR", ""],
];

const workbook  = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(rows);

// Column widths
worksheet["!cols"] = [
  { wch: 12 },
  { wch: 12 },
  { wch: 30 },
  { wch: 12 },
  { wch: 18 },
];

XLSX.utils.book_append_sheet(workbook, worksheet, "Usuarios");

const outDir  = path.resolve(process.cwd(), "docs");
const outPath = path.join(outDir, "usuarios-ejemplo.xlsx");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

XLSX.writeFile(workbook, outPath);
console.log(`✓ Generado: ${outPath}`);
