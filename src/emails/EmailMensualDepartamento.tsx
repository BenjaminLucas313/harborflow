import {
  Body,
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmailMensualDepartamentoProps {
  departamento:       string;
  mes:                string;   // "Abril 2026"
  totalViajes:        number;
  asientosUsados:     number;
  asientosVacios:     number;
  totalAsientos:      number;
  variacionAsientos?: number;   // positivo = más, negativo = menos que mes ant.
  companyName:        string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailMensualDepartamento({
  departamento,
  mes,
  totalViajes,
  asientosUsados,
  asientosVacios,
  totalAsientos,
  variacionAsientos,
  companyName,
}: EmailMensualDepartamentoProps) {
  const hasVariacion = variacionAsientos !== undefined && variacionAsientos !== 0;
  const variacionPositiva = (variacionAsientos ?? 0) > 0;
  const variacionAbs = Math.abs(variacionAsientos ?? 0);

  return (
    <Html lang="es">
      <Head />
      <Preview>Resumen de transporte — {mes} — {departamento}</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── 1. HEADER ─────────────────────────────────────────────── */}
          <Section style={header}>
            <Row>
              <Column style={{ textAlign: "center" as const }}>
                <Img
                  src={`${process.env.NEXT_PUBLIC_APP_URL}/HarborLogo.png`}
                  width="32"
                  height="32"
                  alt="HarborFlow"
                  style={{ borderRadius: "50%" }}
                />
                <Text style={brandText}>HarborFlow</Text>
              </Column>
            </Row>
          </Section>

          {/* ── 2. BODY ───────────────────────────────────────────────── */}
          <Section style={bodyCard}>
            <Text style={greeting}>
              Resumen de {mes} — {departamento}
            </Text>
            <Text style={subtitle}>
              Este es el resumen de actividad de transporte de tu departamento
              durante el mes.
            </Text>

            {/* KPI box */}
            <div style={kpiBox}>
              <Text style={kpiTitle}>RESUMEN DEL MES</Text>

              <Row style={kpiRow}>
                <Column style={kpiLabel}>Viajes realizados</Column>
                <Column style={kpiValue}>{totalViajes}</Column>
              </Row>

              <div style={divider} />

              <Row style={kpiRow}>
                <Column style={kpiLabel}>Asientos utilizados</Column>
                <Column style={kpiValue}>{asientosUsados}</Column>
              </Row>

              <div style={divider} />

              <Row style={kpiRow}>
                <Column style={kpiLabel}>
                  Asientos vacíos asignados
                  <br />
                  <span style={noteText}>(costo proporcional al departamento)</span>
                </Column>
                <Column style={kpiValue}>{asientosVacios.toFixed(2)}</Column>
              </Row>

              <div style={divider} />

              <Row style={kpiRow}>
                <Column style={kpiLabel}>Total asientos liquidados</Column>
                <Column style={{ ...kpiValue, ...kpiValueBold }}>
                  {totalAsientos.toFixed(2)}
                </Column>
              </Row>

              {/* Comparativa mes anterior */}
              {hasVariacion && (
                <>
                  <div style={divider} />
                  <Row style={kpiRow}>
                    <Column style={kpiLabel}>Variación vs mes anterior</Column>
                    <Column
                      style={{
                        ...kpiValue,
                        color: variacionPositiva ? "#15803d" : "#dc2626",
                        fontWeight: 600,
                      }}
                    >
                      {variacionPositiva ? "↑" : "↓"} {variacionAbs.toFixed(2)}{" "}
                      {variacionPositiva ? "más" : "menos"} que el mes anterior
                    </Column>
                  </Row>
                </>
              )}
            </div>

            {/* Informative notice */}
            <div style={noticeBox}>
              <Text style={noticeText}>
                Este resumen es informativo. El cierre definitivo es gestionado
                por {companyName}.
              </Text>
            </div>
          </Section>

          {/* ── 3. HERO ───────────────────────────────────────────────── */}
          <Section style={hero}>
            <Text style={eyebrow}>INFORMACIÓN</Text>
            <Text style={heroTitle}>¿Tenés preguntas sobre este resumen?</Text>
            <Text style={heroSub}>Contactá al equipo de UABL</Text>
          </Section>

          {/* ── 4. FOOTER ─────────────────────────────────────────────── */}
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
// Styles — consistent with BienvenidaEmail
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
  padding: "28px 36px",
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

const kpiBox: React.CSSProperties = {
  backgroundColor: "#f0f6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "16px",
};

const kpiTitle: React.CSSProperties = {
  color: "#1e40af",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  margin: "0 0 12px",
};

const kpiRow: React.CSSProperties = {
  margin: "0",
};

const kpiLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  paddingTop: "6px",
  paddingBottom: "6px",
  width: "55%",
  verticalAlign: "top",
};

const kpiValue: React.CSSProperties = {
  color: "#111827",
  fontSize: "13px",
  fontWeight: 500,
  paddingTop: "6px",
  paddingBottom: "6px",
};

const kpiValueBold: React.CSSProperties = {
  color: "#1e40af",
  fontWeight: 700,
  fontSize: "14px",
};

const noteText: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "11px",
  fontStyle: "italic",
};

const divider: React.CSSProperties = {
  borderTop: "1px solid #dbeafe",
  margin: "2px 0",
};

const noticeBox: React.CSSProperties = {
  backgroundColor: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: "8px",
  padding: "12px 16px",
};

const noticeText: React.CSSProperties = {
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
  margin: "0 0 8px",
};

const heroSub: React.CSSProperties = {
  color: "#7eb8f5",
  fontSize: "14px",
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
