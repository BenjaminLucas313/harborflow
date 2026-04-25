// POST /api/emails/mensual
//
// Envía el resumen mensual de liquidación a cada Department que tenga
// emailContacto configurado.
//
// Auth: UABL + isUablAdmin.
//
// Body (opcional): { mes?: number, anio?: number }
//   Si no se pasa, usa el mes anterior al mes actual en timezone Argentina.
//
// Datos por departamento: obtenidos desde AsientoLiquidacion (un registro
// por viaje por departamento). Suma de: asientosReservados, fraccionVacios,
// totalAsientos. Count = totalViajes del período.
//
// Comparativa: mismas métricas del mes previo al pedido.
//
// Response: { enviados: N, omitidos: N, errores: N }
//   - enviados : departamentos con email a los que se envió con éxito
//   - omitidos : departamentos sin emailContacto configurado
//   - errores  : envíos que fallaron por SMTP u otro error
//
// AuditLog: EMAIL_MENSUAL_ENVIADO

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { auth }                      from "@/lib/auth";
import { AppError }                  from "@/lib/errors";
import { assertRole }                from "@/lib/permissions";
import { prisma }                    from "@/lib/prisma";
import { logAction }                 from "@/modules/audit/repository";
import { sendEmailMensualDepartamento } from "@/services/email.service";

// Argentina: UTC-3, no DST.
const ARG_OFFSET_MS = 3 * 60 * 60 * 1000;

function argNow() {
  const d = new Date(Date.now() - ARG_OFFSET_MS);
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function prevMonth(month: number, year: number) {
  return month === 1
    ? { month: 12, year: year - 1 }
    : { month: month - 1, year };
}

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const BodySchema = z.object({
  mes:  z.number().int().min(1).max(12).optional(),
  anio: z.number().int().min(2020).max(2100).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL"]);

    if (!session.user.isUablAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Solo administradores UABL pueden enviar resúmenes." } },
        { status: 403 },
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed  = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos." } },
        { status: 400 },
      );
    }

    const { companyId } = session.user;

    // Determine target period — default: previous month
    const argCurrent = argNow();
    const prev        = prevMonth(argCurrent.month, argCurrent.year);

    const targetMes  = parsed.data.mes  ?? prev.month;
    const targetAnio = parsed.data.anio ?? prev.year;

    // Comparison period: month before the target
    const compMes  = prevMonth(targetMes, targetAnio);

    const mesLabel = `${MONTH_NAMES[targetMes - 1]} ${targetAnio}`;

    // Fetch company name + departments with emailContacto
    const [company, departments] = await Promise.all([
      prisma.company.findUnique({
        where:  { id: companyId },
        select: { name: true },
      }),
      prisma.department.findMany({
        where:  { companyId, isActive: true },
        select: { id: true, name: true, emailContacto: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const companyName = company?.name ?? "UABL Puerto Rosario";

    let enviados = 0;
    let omitidos = 0;
    let errores  = 0;

    for (const dept of departments) {
      // Skip departments without a contact email
      if (!dept.emailContacto) {
        omitidos++;
        continue;
      }

      // ── Current period liquidation data ──────────────────────────────
      const liquidaciones = await prisma.asientoLiquidacion.findMany({
        where: { companyId, departamentoId: dept.id, mes: targetMes, anio: targetAnio },
        select: { asientosReservados: true, fraccionVacios: true, totalAsientos: true },
      });

      // ── Previous period for comparativa ──────────────────────────────
      const prevLiquidaciones = await prisma.asientoLiquidacion.findMany({
        where: { companyId, departamentoId: dept.id, mes: compMes.month, anio: compMes.year },
        select: { totalAsientos: true },
      });

      // If no data at all for this dept this period, still send (show zeros)
      const totalViajes    = liquidaciones.length;
      const asientosUsados = liquidaciones.reduce((s, l) => s + l.asientosReservados, 0);
      const asientosVacios = liquidaciones.reduce((s, l) => s + Number(l.fraccionVacios), 0);
      const totalAsientos  = liquidaciones.reduce((s, l) => s + Number(l.totalAsientos), 0);

      const prevTotal = prevLiquidaciones.reduce((s, l) => s + Number(l.totalAsientos), 0);
      const variacionAsientos = prevLiquidaciones.length > 0
        ? Math.round((totalAsientos - prevTotal) * 100) / 100
        : undefined;

      try {
        await sendEmailMensualDepartamento({
          departamento:      dept.name,
          email:             dept.emailContacto,
          mes:               mesLabel,
          totalViajes,
          asientosUsados,
          asientosVacios,
          totalAsientos,
          variacionAsientos,
          companyName,
        });
        enviados++;
      } catch {
        errores++;
      }
    }

    // Audit log
    await logAction({
      companyId,
      actorId:    session.user.id,
      action:     "EMAIL_MENSUAL_ENVIADO",
      entityType: "Company",
      entityId:   companyId,
      payload:    { mes: targetMes, anio: targetAnio, enviados, omitidos, errores },
    });

    return NextResponse.json({ enviados, omitidos, errores });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/emails/mensual]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
