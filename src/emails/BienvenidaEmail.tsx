import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface BienvenidaEmailProps {
  nombre: string;
  email: string;
  password: string;
  rol: string;
  loginUrl: string;
}

const ROL_LABELS: Record<string, string> = {
  UABL:      "UABL",
  EMPRESA:   "Empresa",
  PROVEEDOR: "Proveedor",
  USUARIO:   "Usuario",
};

export function BienvenidaEmail({ nombre, email, password, rol, loginUrl }: BienvenidaEmailProps) {
  const rolLabel = ROL_LABELS[rol] ?? rol;

  return (
    <Html lang="es">
      <Head />
      <Preview>Tu cuenta en HarborFlow está lista</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── 1. HEADER ────────────────────────────────────────────────── */}
          <Section style={header}>
            <Row>
              <Column style={{ textAlign: "center" as const }}>
                <Img
                  src={`${process.env.NEXT_PUBLIC_APP_URL}/HarborLogo.png`}
                  width="32"
                  height="32"
                  alt="HarborFlow"
                  style={{ borderRadius: '50%' }}
                />
                <Text style={brandText}>HarborFlow</Text>
              </Column>
            </Row>
          </Section>

          {/* ── 2. BODY ──────────────────────────────────────────────────── */}
          <Section style={bodyCard}>
            <Text style={greeting}>¡Hola, {nombre}!</Text>
            <Text style={subtitle}>
              Tu cuenta en HarborFlow está lista. A continuación encontrás tus credenciales.
            </Text>

            {/* Credentials box */}
            <div style={credBox}>
              <Text style={credTitle}>TUS CREDENCIALES DE ACCESO</Text>

              <Row style={credRow}>
                <Column style={credLabel}>Correo electrónico</Column>
                <Column style={credValue}>{email}</Column>
              </Row>

              <div style={divider} />

              <Row style={credRow}>
                <Column style={credLabel}>Contraseña temporal</Column>
                <Column style={credValue}>
                  <span style={passwordPill}>{password}</span>
                </Column>
              </Row>

              <div style={divider} />

              <Row style={credRow}>
                <Column style={credLabel}>Rol asignado</Column>
                <Column style={credValue}>
                  <span style={rolPill}>{rolLabel}</span>
                </Column>
              </Row>
            </div>

            {/* Warning notice */}
            <div style={warningBox}>
              <Text style={warningText}>
                ⚠️ Por seguridad, el sistema te pedirá que cambies tu contraseña en tu primer ingreso.
              </Text>
            </div>
          </Section>

          {/* ── 3. HERO ──────────────────────────────────────────────────── */}
          <Section style={hero}>
            <Text style={eyebrow}>YA PODÉS COMENZAR</Text>
            <Text style={heroTitle}>
              Ingresá a HarborFlow y gestioná tus viajes
            </Text>
            <Button href={loginUrl} style={heroBtn}>
              Ingresar a HarborFlow →
            </Button>
          </Section>

          {/* ── 4. FOOTER ────────────────────────────────────────────────── */}
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
  textAlign: "center",
};

const brandText: React.CSSProperties = {
  display: "inline-block",
  color: "#f0f6ff",
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  margin: 0,
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
  margin: "0 0 8px",
};

const subtitle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const credBox: React.CSSProperties = {
  backgroundColor: "#f0f6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "16px",
};

const credTitle: React.CSSProperties = {
  color: "#1e40af",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  margin: "0 0 12px",
};

const credRow: React.CSSProperties = {
  margin: "0",
};

const credLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  paddingTop: "6px",
  paddingBottom: "6px",
  width: "45%",
};

const credValue: React.CSSProperties = {
  color: "#111827",
  fontSize: "13px",
  fontWeight: 500,
  paddingTop: "6px",
  paddingBottom: "6px",
};

const divider: React.CSSProperties = {
  borderTop: "1px solid #dbeafe",
  margin: "2px 0",
};

const passwordPill: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#0d1b35",
  color: "#7eb8f5",
  fontFamily: "monospace",
  fontSize: "13px",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: "4px",
  letterSpacing: "0.05em",
};

const rolPill: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: "4px",
};

const warningBox: React.CSSProperties = {
  backgroundColor: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: "8px",
  padding: "12px 16px",
};

const warningText: React.CSSProperties = {
  color: "#92400e",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: 0,
};

const hero: React.CSSProperties = {
  backgroundColor: "#0d1b35",
  padding: "32px 36px",
  textAlign: "center",
};

const eyebrow: React.CSSProperties = {
  color: "#7eb8f5",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  margin: "0 0 8px",
};

const heroTitle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "1.4",
  margin: "0 0 20px",
};

const heroBtn: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#ffffff",
  color: "#0d1b35",
  fontSize: "14px",
  fontWeight: 700,
  padding: "12px 28px",
  borderRadius: "8px",
  textDecoration: "none",
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
