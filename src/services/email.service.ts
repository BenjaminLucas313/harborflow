// =============================================================================
// HarborFlow — Email service (Brevo SMTP via nodemailer)
//
// All send functions are best-effort: they catch errors and log them without
// throwing, so caller flows (user creation, password reset) never fail due to
// email delivery issues.
//
// In development without BREVO_SMTP_LOGIN set, emails are logged to console
// instead of sent, allowing the full flow to run without credentials.
// =============================================================================

import nodemailer              from "nodemailer";
import * as Sentry             from "@sentry/nextjs";
import { render }              from "@react-email/render";
import { BienvenidaEmail }                from "@/emails/BienvenidaEmail";
import { ResetPasswordEmail }            from "@/emails/ResetPasswordEmail";
import { ConductorEmail }               from "@/emails/ConductorEmail";
import { EmailMensualDepartamento }     from "@/emails/EmailMensualDepartamento";
import { EmailMensualAdmin }            from "@/emails/EmailMensualAdmin";
import { prisma }                        from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Config — read env vars lazily inside each function, NOT at module level.
// Reading at module level can cache empty strings if the module is imported
// before Next.js finishes injecting the .env values (e.g. during cold start).
// ---------------------------------------------------------------------------

function getConfig() {
  const login    = process.env.BREVO_SMTP_LOGIN ?? "";
  const key      = process.env.BREVO_SMTP_KEY   ?? "";
  const from     = process.env.EMAIL_FROM        ?? "HarborFlow <noreply@harborflow.app>";
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hasBrevo = login.length > 0 && key.length > 0;
  const isDev    = process.env.NODE_ENV !== "production";
  return { login, key, from, appUrl, hasBrevo, isDev };
}

function makeTransporter(login: string, key: string) {
  return nodemailer.createTransport({
    host:   "smtp-relay.brevo.com",
    port:   587,
    secure: false,
    auth:   { user: login, pass: key },
  });
}

// ---------------------------------------------------------------------------
// sendBienvenida
// ---------------------------------------------------------------------------

export interface BienvenidaParams {
  nombre:   string;
  email:    string;
  password: string;
  rol:      string;
}

export async function sendBienvenida(params: BienvenidaParams): Promise<void> {
  const { login, key, from, appUrl, hasBrevo, isDev } = getConfig();

  console.log("[email:bienvenida] called — hasBrevo:", hasBrevo, "| isDev:", isDev, "| to:", params.email);

  if (!hasBrevo) {
    if (isDev) {
      console.log("[email:bienvenida] DEV MOCK (no BREVO credentials configured)");
      console.log("  → nombre:   ", params.nombre);
      console.log("  → password: ", params.password);
      console.log("  → rol:      ", params.rol);
    } else {
      console.error("[email:bienvenida] ERROR: BREVO_SMTP_LOGIN / BREVO_SMTP_KEY not set in production!");
    }
    return;
  }

  try {
    console.log("[email:bienvenida] rendering template...");
    const html = await render(
      BienvenidaEmail({ ...params, loginUrl: appUrl + "/login" }),
    );
    console.log("[email:bienvenida] template rendered, sending via SMTP...");

    const transporter = makeTransporter(login, key);
    await transporter.sendMail({
      from,
      to:      params.email,
      subject: "¡Tu cuenta en HarborFlow está lista!",
      html,
    });

    console.log("[email:bienvenida] ✓ sent successfully →", params.email);
  } catch (err) {
    console.error("[email:bienvenida] ✗ SMTP error:", err);
    Sentry.captureException(err, { tags: { service: "email", type: "bienvenida" }, extra: { to: params.email } });
  }
}

// ---------------------------------------------------------------------------
// sendResetPassword
// ---------------------------------------------------------------------------

export interface ResetPasswordParams {
  nombre: string;
  email:  string;
  token:  string;
}

// ---------------------------------------------------------------------------
// sendEmailConductor
// ---------------------------------------------------------------------------

export interface ConductorEmailParams {
  nombre:       string;
  email:        string;
  tripId:       string;
  fecha:        string;
  lancha:       string;
  ruta:         string;
  pasajeros:    Array<{ nombre: string; departamento: string }>;
  checklistUrl: string;
}

export async function sendEmailConductor(params: ConductorEmailParams): Promise<void> {
  const { login, key, from, hasBrevo, isDev } = getConfig();

  console.log("[email:conductor] called — hasBrevo:", hasBrevo, "| isDev:", isDev, "| to:", params.email);

  if (!hasBrevo) {
    if (isDev) {
      console.log("[email:conductor] DEV MOCK (no BREVO credentials configured)");
      console.log("  → nombre:  ", params.nombre);
      console.log("  → fecha:   ", params.fecha);
      console.log("  → lancha:  ", params.lancha);
      console.log("  → ruta:    ", params.ruta);
      console.log("  → pasajeros:", params.pasajeros.length);
    } else {
      console.error("[email:conductor] ERROR: BREVO_SMTP_LOGIN / BREVO_SMTP_KEY not set in production!");
    }
    return;
  }

  try {
    console.log("[email:conductor] rendering template...");
    const html = await render(
      ConductorEmail({
        nombre:       params.nombre,
        tripId:       params.tripId,
        fecha:        params.fecha,
        lancha:       params.lancha,
        ruta:         params.ruta,
        pasajeros:    params.pasajeros,
        checklistUrl: params.checklistUrl,
      }),
    );
    console.log("[email:conductor] template rendered, sending via SMTP...");

    const transporter = makeTransporter(login, key);
    await transporter.sendMail({
      from,
      to:      params.email,
      subject: `Fuiste asignado a un viaje — ${params.fecha}`,
      html,
    });

    console.log("[email:conductor] ✓ sent successfully →", params.email);
  } catch (err) {
    console.error("[email:conductor] ✗ SMTP error:", err);
    Sentry.captureException(err, { tags: { service: "email", type: "conductor" }, extra: { to: params.email } });
  }
}

// ---------------------------------------------------------------------------
// sendResetPassword
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// sendEmailMensualDepartamento
// ---------------------------------------------------------------------------

export interface EmailMensualDepartamentoParams {
  departamento:       string;
  email:              string;
  mes:                string;   // "Abril 2026"
  totalViajes:        number;
  asientosUsados:     number;
  asientosVacios:     number;
  totalAsientos:      number;
  variacionAsientos?: number;
  companyName:        string;
}

export async function sendEmailMensualDepartamento(
  params: EmailMensualDepartamentoParams,
): Promise<void> {
  const { login, key, from, hasBrevo, isDev } = getConfig();

  console.log(
    "[email:mensual-dept] called — hasBrevo:", hasBrevo,
    "| isDev:", isDev,
    "| to:", params.email,
    "| dept:", params.departamento,
  );

  if (!hasBrevo) {
    if (isDev) {
      console.log("[email:mensual-dept] DEV MOCK (no BREVO credentials configured)");
      console.log("  → departamento:", params.departamento);
      console.log("  → mes:         ", params.mes);
      console.log("  → totalViajes: ", params.totalViajes);
      console.log("  → totalAsientos:", params.totalAsientos);
    } else {
      console.error("[email:mensual-dept] ERROR: BREVO_SMTP_LOGIN / BREVO_SMTP_KEY not set in production!");
    }
    return;
  }

  try {
    const html = await render(
      EmailMensualDepartamento({
        departamento:       params.departamento,
        mes:                params.mes,
        totalViajes:        params.totalViajes,
        asientosUsados:     params.asientosUsados,
        asientosVacios:     params.asientosVacios,
        totalAsientos:      params.totalAsientos,
        variacionAsientos:  params.variacionAsientos,
        companyName:        params.companyName,
      }),
    );

    const transporter = makeTransporter(login, key);
    await transporter.sendMail({
      from,
      to:      params.email,
      subject: `Resumen de transporte — ${params.mes} — ${params.departamento}`,
      html,
    });

    console.log("[email:mensual-dept] ✓ sent →", params.email);
  } catch (err) {
    console.error("[email:mensual-dept] ✗ SMTP error:", err);
    Sentry.captureException(err, { tags: { service: "email", type: "mensual-departamento" }, extra: { to: params.email, departamento: params.departamento } });
    throw err; // re-throw so the caller can track errores count
  }
}

// ---------------------------------------------------------------------------
// enviarResumenMensualEmpresa
// ---------------------------------------------------------------------------
//
// Sends the monthly liquidation summary email to every department in a company
// that has emailContacto configured.
//
// Used by:
//   - /api/emails/mensual route (admin-triggered, authenticated)
//   - /api/jobs/cierre-mensual job (cron-triggered, X-Job-Secret)
//
// Returns counts instead of throwing, so orchestrators can track partial
// success across multiple companies.

const MONTH_NAMES_EMAIL = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function prevMonthEmail(mes: number, anio: number): { mes: number; anio: number } {
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}

export type ResumenMensualEmailResult = { enviados: number; omitidos: number; errores: number };

export async function enviarResumenMensualEmpresa(
  companyId: string,
  mes:       number,
  anio:      number,
): Promise<ResumenMensualEmailResult> {
  const prev      = prevMonthEmail(mes, anio);
  const mesLabel  = `${MONTH_NAMES_EMAIL[mes - 1] ?? `Mes ${mes}`} ${anio}`;

  const [company, departments] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    prisma.department.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true, emailContacto: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const companyName = company?.name ?? "HarborFlow";

  let enviados = 0;
  let omitidos = 0;
  let errores  = 0;

  for (const dept of departments) {
    if (!dept.emailContacto) {
      omitidos++;
      continue;
    }

    const [liquidaciones, prevLiquidaciones] = await Promise.all([
      prisma.asientoLiquidacion.findMany({
        where:  { companyId, departamentoId: dept.id, mes, anio },
        select: { asientosReservados: true, fraccionVacios: true, totalAsientos: true },
      }),
      prisma.asientoLiquidacion.findMany({
        where:  { companyId, departamentoId: dept.id, mes: prev.mes, anio: prev.anio },
        select: { totalAsientos: true },
      }),
    ]);

    const totalViajes    = liquidaciones.length;
    const asientosUsados = liquidaciones.reduce((s, l) => s + l.asientosReservados, 0);
    const asientosVacios = liquidaciones.reduce((s, l) => s + Number(l.fraccionVacios), 0);
    const totalAsientos  = liquidaciones.reduce((s, l) => s + Number(l.totalAsientos), 0);
    const prevTotal      = prevLiquidaciones.reduce((s, l) => s + Number(l.totalAsientos), 0);
    const variacionAsientos = prevLiquidaciones.length > 0
      ? Math.round((totalAsientos - prevTotal) * 100) / 100
      : undefined;

    try {
      await sendEmailMensualDepartamento({
        departamento:     dept.name,
        email:            dept.emailContacto,
        mes:              mesLabel,
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

  return { enviados, omitidos, errores };
}

// ---------------------------------------------------------------------------
// sendEmailMensualAdmin
// ---------------------------------------------------------------------------

export interface EmailMensualAdminParams {
  mes:          string;
  companyName:  string;
  emailDestino: string;
  kpis: {
    totalViajes:        number;
    variacionViajes:    number;
    ocupacionPromedio:  number;
    variacionOcupacion: number;
    totalPasajeros:     number;
    variacionPasajeros: number;
    asientosLiquidados: number;
  };
  departamentos: Array<{
    name:           string;
    viajes:         number;
    asientosUsados: number;
    asientosVacios: number;
    total:          number;
  }>;
  destacados: {
    masViajes:      { name: string; viajes: number; asientos: number };
    mejorOcupacion: { name: string; ocupacion: number };
  };
  operacion: {
    lanchasActivas: number;
    conductores:    number;
    cancelaciones:  number;
  };
}

export async function sendEmailMensualAdmin(params: EmailMensualAdminParams): Promise<void> {
  const { login, key, from, hasBrevo, isDev } = getConfig();

  console.log(
    "[email:mensual-admin] called — hasBrevo:", hasBrevo,
    "| isDev:", isDev,
    "| to:", params.emailDestino,
  );

  if (!hasBrevo) {
    if (isDev) {
      console.log("[email:mensual-admin] DEV MOCK (no BREVO credentials configured)");
      console.log("  → destino:       ", params.emailDestino);
      console.log("  → mes:           ", params.mes);
      console.log("  → totalViajes:   ", params.kpis.totalViajes);
      console.log("  → departamentos: ", params.departamentos.length);
    } else {
      console.error("[email:mensual-admin] ERROR: BREVO credentials not set in production!");
    }
    return;
  }

  try {
    const html = await render(
      EmailMensualAdmin({
        mes:           params.mes,
        companyName:   params.companyName,
        kpis:          params.kpis,
        departamentos: params.departamentos,
        destacados:    params.destacados,
        operacion:     params.operacion,
      }),
    );

    const transporter = makeTransporter(login, key);
    await transporter.sendMail({
      from,
      to:      params.emailDestino,
      subject: `Resumen mensual de operaciones — ${params.mes} — ${params.companyName}`,
      html,
    });

    console.log("[email:mensual-admin] ✓ sent →", params.emailDestino);
  } catch (err) {
    console.error("[email:mensual-admin] ✗ SMTP error:", err);
    Sentry.captureException(err, {
      tags:  { service: "email", type: "mensual-admin" },
      extra: { to: params.emailDestino, mes: params.mes },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// generarYEnviarResumenAdmin
// ---------------------------------------------------------------------------
//
// Orchestrates the admin consolidated email for one company:
//   1. Checks emailAdministrador — skips if not configured.
//   2. Loads current and previous SnapshotMensual for KPI deltas.
//   3. Aggregates AsientoLiquidacion by dept for the detail table.
//   4. Counts distinct boats/drivers from Trip for the operación section.
//   5. Calls sendEmailMensualAdmin().

function argPeriodRange(mes: number, anio: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0, 0)),
    to:   new Date(Date.UTC(anio, mes,     1, 2, 59, 59, 999)),
  };
}

export async function generarYEnviarResumenAdmin(
  companyId: string,
  mes:       number,
  anio:      number,
): Promise<void> {
  const mesLabel = `${MONTH_NAMES_EMAIL[mes - 1] ?? `Mes ${mes}`} ${anio}`;
  const prev     = prevMonthEmail(mes, anio);
  const { from: periodFrom, to: periodTo } = argPeriodRange(mes, anio);

  // 1. Company + emailAdministrador
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: { name: true, emailAdministrador: true },
  });

  if (!company?.emailAdministrador) {
    console.log(`[email:admin] Sin emailAdministrador en company ${companyId}, saltando.`);
    return;
  }

  // 2. Snapshots (current + previous for deltas)
  const [snapshot, prevSnapshot] = await Promise.all([
    prisma.snapshotMensual.findUnique({
      where: { companyId_mes_anio: { companyId, mes, anio } },
    }),
    prisma.snapshotMensual.findUnique({
      where: { companyId_mes_anio: { companyId, mes: prev.mes, anio: prev.anio } },
    }),
  ]);

  if (!snapshot) {
    console.warn(`[email:admin] No snapshot para ${companyId} ${mes}/${anio}. Saltando.`);
    return;
  }

  // 3. AsientoLiquidacion grouped by dept
  const liquidaciones = await prisma.asientoLiquidacion.findMany({
    where:  { companyId, mes, anio },
    select: {
      departamentoId:     true,
      viajeId:            true,
      asientosReservados: true,
      fraccionVacios:     true,
      totalAsientos:      true,
    },
  });

  // 4. Dept names
  const deptIds = [...new Set(liquidaciones.map((l) => l.departamentoId))];
  const depts   = await prisma.department.findMany({
    where:  { id: { in: deptIds } },
    select: { id: true, name: true },
  });
  const deptName = new Map(depts.map((d) => [d.id, d.name]));

  type DeptAgg = {
    name:           string;
    viajeIds:       Set<string>;
    asientosUsados: number;
    asientosVacios: number;
    total:          number;
  };
  const deptMap = new Map<string, DeptAgg>();

  for (const liq of liquidaciones) {
    const name = deptName.get(liq.departamentoId) ?? liq.departamentoId;
    const agg  = deptMap.get(liq.departamentoId) ??
      { name, viajeIds: new Set<string>(), asientosUsados: 0, asientosVacios: 0, total: 0 };
    agg.viajeIds.add(liq.viajeId);
    agg.asientosUsados += liq.asientosReservados;
    agg.asientosVacios += Number(liq.fraccionVacios);
    agg.total          += Number(liq.totalAsientos);
    deptMap.set(liq.departamentoId, agg);
  }

  const departamentos = [...deptMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      name:           d.name,
      viajes:         d.viajeIds.size,
      asientosUsados: d.asientosUsados,
      asientosVacios: Math.round(d.asientosVacios * 100) / 100,
      total:          Math.round(d.total          * 100) / 100,
    }));

  // 5. Distinct boats and drivers from trips in period
  const tripsInPeriod = await prisma.trip.findMany({
    where:  { companyId, departureTime: { gte: periodFrom, lte: periodTo } },
    select: { boatId: true, driverId: true },
  });
  const lanchasActivas = new Set(tripsInPeriod.map((t) => t.boatId).filter(Boolean)).size;
  const conductores    = new Set(tripsInPeriod.map((t) => t.driverId).filter(Boolean)).size;

  // 6. KPIs
  const curOcup  = parseFloat(snapshot.promedioOcupacion.toString());
  const prevOcup = prevSnapshot ? parseFloat(prevSnapshot.promedioOcupacion.toString()) : undefined;
  const curPax   = parseFloat(snapshot.totalAsientosOcupados.toString());
  const prevPax  = prevSnapshot ? parseFloat(prevSnapshot.totalAsientosOcupados.toString()) : 0;
  const asientosLiquidados = departamentos.reduce((s, d) => s + d.total, 0);

  const kpis: EmailMensualAdminParams["kpis"] = {
    totalViajes:        snapshot.totalViajes,
    variacionViajes:    prevSnapshot ? snapshot.totalViajes - prevSnapshot.totalViajes : 0,
    ocupacionPromedio:  curOcup,
    variacionOcupacion: prevOcup !== undefined
      ? Math.round((curOcup - prevOcup) * 10000) / 100
      : 0,
    totalPasajeros:     Math.round(curPax),
    variacionPasajeros: prevSnapshot ? Math.round(curPax - prevPax) : 0,
    asientosLiquidados: Math.round(asientosLiquidados * 100) / 100,
  };

  // 7. Destacados
  const byViajes      = [...departamentos].sort((a, b) => b.viajes - a.viajes);
  const masViajesDept = byViajes[0];

  const mejorOcupDept = departamentos.length > 0
    ? departamentos.reduce((best, d) => {
        const t  = d.asientosUsados + d.asientosVacios;
        const o  = t  > 0 ? d.asientosUsados    / t  : 0;
        const bt = best.asientosUsados + best.asientosVacios;
        const bo = bt > 0 ? best.asientosUsados  / bt : 0;
        return o > bo ? d : best;
      })
    : null;

  const destacados: EmailMensualAdminParams["destacados"] = {
    masViajes: {
      name:     masViajesDept?.name           ?? "—",
      viajes:   masViajesDept?.viajes         ?? 0,
      asientos: masViajesDept?.asientosUsados ?? 0,
    },
    mejorOcupacion: {
      name:     mejorOcupDept?.name ?? "—",
      ocupacion: mejorOcupDept
        ? (() => {
            const t = mejorOcupDept.asientosUsados + mejorOcupDept.asientosVacios;
            return t > 0 ? Math.round((mejorOcupDept.asientosUsados / t) * 10000) / 100 : 0;
          })()
        : 0,
    },
  };

  await sendEmailMensualAdmin({
    mes:           mesLabel,
    companyName:   company.name,
    emailDestino:  company.emailAdministrador,
    kpis,
    departamentos,
    destacados,
    operacion: { lanchasActivas, conductores, cancelaciones: snapshot.cancelaciones },
  });
}

// ---------------------------------------------------------------------------
// sendResetPassword
// ---------------------------------------------------------------------------

export async function sendResetPassword(params: ResetPasswordParams): Promise<void> {
  const { login, key, from, appUrl, hasBrevo, isDev } = getConfig();
  const resetUrl = `${appUrl}/reset-password?token=${params.token}`;

  console.log("[email:reset-password] called — hasBrevo:", hasBrevo, "| isDev:", isDev, "| to:", params.email);

  if (!hasBrevo) {
    if (isDev) {
      console.log("[email:reset-password] DEV MOCK (no BREVO credentials configured)");
      console.log("  → nombre:   ", params.nombre);
      console.log("  → resetUrl: ", resetUrl);
    } else {
      console.error("[email:reset-password] ERROR: BREVO credentials not set in production!");
    }
    return;
  }

  try {
    console.log("[email:reset-password] rendering template...");
    const html = await render(
      ResetPasswordEmail({ nombre: params.nombre, resetUrl }),
    );
    console.log("[email:reset-password] template rendered, sending via SMTP...");

    const transporter = makeTransporter(login, key);
    await transporter.sendMail({
      from,
      to:      params.email,
      subject: "Restablecer contraseña — HarborFlow",
      html,
    });

    console.log("[email:reset-password] ✓ sent successfully →", params.email);
  } catch (err) {
    console.error("[email:reset-password] ✗ SMTP error:", err);
    Sentry.captureException(err, { tags: { service: "email", type: "reset-password" }, extra: { to: params.email } });
  }
}
