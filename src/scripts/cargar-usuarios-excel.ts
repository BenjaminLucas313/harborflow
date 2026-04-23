// =============================================================================
// Script: cargar-usuarios-excel
// =============================================================================
//
// Carga masiva de usuarios desde un archivo Excel (.xlsx).
//
// Uso:
//   npx tsx --env-file=.env src/scripts/cargar-usuarios-excel.ts \
//     --file=ruta/al/archivo.xlsx \
//     --company=slug-o-nombre-de-empresa
//
// Columnas requeridas (case-insensitive):
//   nombre, apellido, email, rol
// Columnas opcionales:
//   departamento
//
// Roles válidos: USUARIO, EMPRESA, UABL, PROVEEDOR
// Nota: CONDUCTOR no es un rol de usuario — es un modelo Driver separado.
// =============================================================================

import { randomBytes }    from "crypto";
import * as readline      from "readline";
import * as fs            from "fs";
import * as path          from "path";
import * as XLSX          from "xlsx";
import bcrypt             from "bcryptjs";
import { prisma }         from "@/lib/prisma";
import { logAction }      from "@/modules/audit/repository";
import { sendBienvenida } from "@/services/email.service";
import type { UserRole }  from "@prisma/client";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { file: string; company: string } {
  const args = process.argv.slice(2);
  const get  = (flag: string): string | null => {
    const entry = args.find((a) => a.startsWith(`--${flag}=`));
    return entry ? entry.slice(flag.length + 3) : null;
  };

  const file    = get("file");
  const company = get("company");

  if (!file || !company) {
    console.error(
      "Uso: npx tsx --env-file=.env src/scripts/cargar-usuarios-excel.ts" +
      " --file=<archivo.xlsx> --company=<slug-o-nombre>",
    );
    process.exit(1);
  }

  return { file, company };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_ROLES = ["USUARIO", "EMPRESA", "UABL", "PROVEEDOR"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

interface ExcelRow {
  rowNum:       number;
  nombre:       string;
  apellido:     string;
  email:        string;
  rol:          string;
  departamento: string | undefined;
}

interface ValidatedRow extends ExcelRow {
  role: ValidRole;
}

interface ValidationError {
  rowNum: number;
  email:  string;
  reason: string;
}

type RowResult = "creado" | "reactivado" | "omitido" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const clean = answer.trim().toLowerCase();
      resolve(clean === "s" || clean === "y" || clean === "si" || clean === "yes");
    });
  });
}

// ---------------------------------------------------------------------------
// Excel parsing
// ---------------------------------------------------------------------------

const COL_ALIASES: Record<string, keyof ExcelRow | null> = {
  nombre:       "nombre",
  firstname:    "nombre",
  first_name:   "nombre",
  apellido:     "apellido",
  lastname:     "apellido",
  last_name:    "apellido",
  email:        "email",
  correo:       "email",
  rol:          "rol",
  role:         "rol",
  departamento: "departamento",
  department:   "departamento",
};

const REQUIRED_LOGICAL = ["nombre", "apellido", "email", "rol"] as const;

function parseExcel(filePath: string): ExcelRow[] {
  const workbook = XLSX.readFile(filePath);

  // Prefer sheet named "Usuarios" (case-insensitive), else first sheet
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === "usuarios") ??
    workbook.SheetNames[0];

  if (!sheetName) throw new Error("El archivo Excel no contiene ninguna hoja.");

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No se pudo leer la hoja "${sheetName}".`);
  const raw   = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw:    false,
  });

  if (raw.length === 0) {
    throw new Error(`La hoja "${sheetName}" no contiene filas de datos.`);
  }

  // Build header → logical column mapping
  const firstRow  = raw[0]!;
  const headerMap = new Map<string, keyof ExcelRow>();
  for (const key of Object.keys(firstRow)) {
    const normalized = key.trim().toLowerCase().replace(/\s+/g, "_");
    const logical    = COL_ALIASES[normalized];
    if (logical) headerMap.set(key, logical as keyof ExcelRow);
  }

  // Check required columns are present
  const present = new Set(headerMap.values());
  const missing = REQUIRED_LOGICAL.filter((c) => !present.has(c));
  if (missing.length > 0) {
    throw new Error(`Columnas requeridas faltantes: ${missing.join(", ")}`);
  }

  // Helper: get cell value for a logical column
  const get = (row: Record<string, unknown>, target: keyof ExcelRow): string => {
    for (const [key, logical] of headerMap) {
      if (logical === target) return String(row[key] ?? "").trim();
    }
    return "";
  };

  return raw.map((row, i): ExcelRow => ({
    rowNum:       i + 2,
    nombre:       get(row, "nombre"),
    apellido:     get(row, "apellido"),
    email:        get(row, "email").toLowerCase(),
    rol:          get(row, "rol").toUpperCase(),
    departamento: get(row, "departamento") || undefined,
  }));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRows(rows: ExcelRow[]): {
  valid:  ValidatedRow[];
  errors: ValidationError[];
} {
  const valid:      ValidatedRow[]   = [];
  const errors:     ValidationError[] = [];
  const seenEmails: Set<string>      = new Set();

  for (const row of rows) {
    const issues: string[] = [];

    if (!row.nombre)   issues.push("nombre vacío");
    if (!row.apellido) issues.push("apellido vacío");

    if (!row.email) {
      issues.push("email vacío");
    } else if (!EMAIL_RE.test(row.email)) {
      issues.push(`email inválido: "${row.email}"`);
    } else if (seenEmails.has(row.email)) {
      issues.push("email duplicado en el Excel");
    }

    if (!(VALID_ROLES as readonly string[]).includes(row.rol)) {
      issues.push(
        `rol inválido: "${row.rol}" — válidos: ${VALID_ROLES.join(", ")}`,
      );
    }

    if (issues.length > 0) {
      errors.push({ rowNum: row.rowNum, email: row.email || "(vacío)", reason: issues.join("; ") });
    } else {
      seenEmails.add(row.email);
      valid.push({ ...row, role: row.rol as ValidRole });
    }
  }

  return { valid, errors };
}

// ---------------------------------------------------------------------------
// Process a single row
// ---------------------------------------------------------------------------

async function processRow(
  row:           ValidatedRow,
  companyId:     string,
  departmentMap: Map<string, string>,
): Promise<{ result: RowResult; email: string; detail?: string }> {
  try {
    const existing = await prisma.user.findFirst({
      where:  { companyId, email: row.email },
      select: { id: true, isActive: true },
    });

    // Active user → skip
    if (existing?.isActive) {
      return { result: "omitido", email: row.email };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const departmentId = row.departamento
      ? departmentMap.get(row.departamento.toLowerCase())
      : undefined;

    if (existing && !existing.isActive) {
      // Reactivate soft-deleted user, preserving id and audit history
      await prisma.user.updateMany({
        where: { id: existing.id, companyId },
        data:  {
          firstName:          row.nombre,
          lastName:           row.apellido,
          role:               row.role as UserRole,
          passwordHash,
          departmentId:       departmentId ?? null,
          mustChangePassword: true,
          isActive:           true,
        },
      });

      await logAction({
        companyId,
        action:     "USER_CREATED",
        entityType: "User",
        entityId:   existing.id,
        payload:    { email: row.email, role: row.role, reactivated: true, source: "batch-import" },
      });

      sendBienvenida({ nombre: row.nombre, email: row.email, password: tempPassword, rol: row.role })
        .catch((err) => console.error(`[batch] sendBienvenida (${row.email}):`, err));

      return { result: "reactivado", email: row.email };
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        companyId,
        email:              row.email,
        passwordHash,
        firstName:          row.nombre,
        lastName:           row.apellido,
        role:               row.role as UserRole,
        departmentId:       departmentId ?? null,
        mustChangePassword: true,
      },
      select: { id: true },
    });

    await logAction({
      companyId,
      action:     "USER_CREATED",
      entityType: "User",
      entityId:   user.id,
      payload:    { email: row.email, role: row.role, source: "batch-import" },
    });

    sendBienvenida({ nombre: row.nombre, email: row.email, password: tempPassword, rol: row.role })
      .catch((err) => console.error(`[batch] sendBienvenida (${row.email}):`, err));

    return { result: "creado", email: row.email };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { result: "error", email: row.email, detail };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { file, company } = parseArgs();

  // 1. Verify file exists
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`\n✗ Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  // 2. Verify company exists (by slug or name)
  const companyRecord = await prisma.company.findFirst({
    where: {
      OR:       [{ slug: company }, { name: { equals: company, mode: "insensitive" } }],
      isActive: true,
    },
    select: { id: true, name: true },
  });

  if (!companyRecord) {
    console.error(`\n✗ Empresa no encontrada o inactiva: "${company}"`);
    console.error("  Verificá el slug o nombre en la base de datos.");
    process.exit(1);
  }

  console.log(`\n[cargar-usuarios] Empresa : ${companyRecord.name}`);
  console.log(`[cargar-usuarios] Archivo : ${filePath}\n`);

  // 3. Parse Excel
  let rows: ExcelRow[];
  try {
    rows = parseExcel(filePath);
  } catch (err) {
    console.error(`✗ Error leyendo Excel: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log(`[cargar-usuarios] ${rows.length} fila(s) encontrada(s)\n`);

  // 4. Validate all rows
  const { valid, errors } = validateRows(rows);

  if (errors.length > 0) {
    console.log(`⚠  Errores de validación — ${errors.length} fila(s) inválida(s):\n`);
    for (const e of errors) {
      const label = `Fila ${String(e.rowNum).padStart(3)}`;
      console.log(`   ${label}  ${e.email.padEnd(40)}  ${e.reason}`);
    }
    console.log();
  }

  if (valid.length === 0) {
    console.log("✗ No hay filas válidas para procesar. Abortando.");
    process.exit(1);
  }

  // 5. Ask for confirmation if there were validation errors
  if (errors.length > 0) {
    const proceed = await askConfirmation(
      `¿Continuar con las ${valid.length} fila(s) válidas, ignorando las ${errors.length} inválidas? [s/n] `,
    );
    if (!proceed) {
      console.log("\nOperación cancelada.");
      process.exit(0);
    }
    console.log();
  }

  // 6. Build department lookup (name → id), case-insensitive
  const departments = await prisma.department.findMany({
    where:  { companyId: companyRecord.id, isActive: true },
    select: { id: true, name: true },
  });
  const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

  // Warn about departments referenced in the Excel that don't exist in DB
  const unresolvedDepts = [
    ...new Set(
      valid
        .filter((r) => r.departamento && !departmentMap.has(r.departamento.toLowerCase()))
        .map((r) => r.departamento!),
    ),
  ];
  if (unresolvedDepts.length > 0) {
    console.log(
      `⚠  Departamentos no encontrados (campo se ignorará): ${unresolvedDepts.join(", ")}\n`,
    );
  }

  // 7. Process rows one by one
  let creados = 0, reactivados = 0, omitidos = 0, errores = 0;

  for (const row of valid) {
    const { result, email, detail } = await processRow(row, companyRecord.id, departmentMap);
    switch (result) {
      case "creado":
        console.log(`  ✓ creado       ${email}`);
        creados++;
        break;
      case "reactivado":
        console.log(`  ↺ reactivado   ${email}`);
        reactivados++;
        break;
      case "omitido":
        console.log(`  → omitido      ${email}  (ya activo)`);
        omitidos++;
        break;
      case "error":
        console.log(`  ✗ error        ${email}  ${detail ?? ""}`);
        errores++;
        break;
    }
  }

  // 8. Summary table
  console.log(`
╔═══════════════════════════════════╗
  Resumen de carga masiva
  ✓ Creados:               ${String(creados).padStart(4)}
  ↺ Reactivados:           ${String(reactivados).padStart(4)}
  → Omitidos (ya activos): ${String(omitidos).padStart(4)}
  ✗ Errores:               ${String(errores).padStart(4)}
╚═══════════════════════════════════╝
`);
}

main()
  .catch((err) => {
    console.error("[cargar-usuarios] Error fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
