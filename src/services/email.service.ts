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

import nodemailer          from "nodemailer";
import { render }          from "@react-email/render";
import { BienvenidaEmail } from "@/emails/BienvenidaEmail";
import { ResetPasswordEmail } from "@/emails/ResetPasswordEmail";

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
  }
}
