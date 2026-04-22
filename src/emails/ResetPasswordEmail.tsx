import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ResetPasswordEmailProps {
  nombre: string;
  resetUrl: string;
}

export function ResetPasswordEmail({ nombre, resetUrl }: ResetPasswordEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Restablecé tu contraseña en HarborFlow</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── HEADER ───────────────────────────────────────────────────── */}
          <Section style={header}>
            <div style={iconCircle}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7eb8f5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5" r="3" />
                <line x1="12" y1="8" x2="12" y2="22" />
                <path d="M5 15H2a10 10 0 0 0 20 0h-3" />
              </svg>
            </div>
            <span style={brandText}>HarborFlow</span>
          </Section>

          {/* ── BODY ─────────────────────────────────────────────────────── */}
          <Section style={bodyCard}>
            <Text style={greeting}>¡Hola, {nombre}!</Text>
            <Text style={bodyText}>
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en HarborFlow.
            </Text>
            <Text style={bodyText}>
              Hacé clic en el botón a continuación para crear una nueva contraseña:
            </Text>

            <div style={{ textAlign: "center" as const, margin: "28px 0" }}>
              <Button href={resetUrl} style={resetBtn}>
                Restablecer contraseña
              </Button>
            </div>

            <div style={noticeBox}>
              <Text style={noticeText}>
                🕐 Este link expira en <strong>1 hora</strong>. Si no solicitaste este cambio,
                ignorá este mensaje — tu contraseña no será modificada.
              </Text>
            </div>
          </Section>

          {/* ── FOOTER ───────────────────────────────────────────────────── */}
          <Section style={footer}>
            <Text style={footerText}>HarborFlow — Puerto Rosario</Text>
            <Text style={footerText}>Sistema de gestión operativa portuaria</Text>
            <Text style={{ ...footerText, marginTop: "8px", color: "#9ca3af" }}>
              Este email fue enviado automáticamente.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const body: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "520px",
  margin: "40px auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  backgroundColor: "#0d1b35",
  padding: "20px 32px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const iconCircle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  backgroundColor: "#1a3560",
  verticalAlign: "middle",
  marginRight: "10px",
};

const brandText: React.CSSProperties = {
  color: "#f0f6ff",
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  verticalAlign: "middle",
};

const bodyCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "32px 36px",
};

const greeting: React.CSSProperties = {
  color: "#0d1b35",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 12px",
};

const bodyText: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const resetBtn: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#1d4ed8",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  padding: "13px 32px",
  borderRadius: "8px",
  textDecoration: "none",
};

const noticeBox: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "12px 16px",
  marginTop: "8px",
};

const noticeText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: 0,
};

const footer: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  padding: "20px 36px",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  margin: "2px 0",
  lineHeight: "1.5",
};
