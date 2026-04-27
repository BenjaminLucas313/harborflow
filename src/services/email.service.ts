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
