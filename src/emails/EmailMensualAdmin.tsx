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

export interface EmailMensualAdminProps {
  mes:         string;   // "Abril 2026"
  companyName: string;
  kpis: {
    totalViajes:        number;
    variacionViajes:    number;   // diferencia absoluta vs mes anterior
    ocupacionPromedio:  number;   // 0.0–1.0
    variacionOcupacion: number;   // diferencia en pp (ej: 5.3 = +5.3 pp)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Variacion({ value, unit = "" }: { value: number; unit?: string }) {
  if (value === 0) return null;
  const pos = value > 0;
  return (
    <Text style={{ ...varText, color: pos ? "#15803d" : "#b91c1c" }}>
      {pos ? "↑" : "↓"} {Math.abs(value)}{unit} {pos ? "más" : "menos"} que el mes anterior
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailMensualAdmin({
  mes,
  companyName,
  kpis,
  departamentos,
  destacados,
  operacion,
}: EmailMensualAdminProps) {
  const ocupPct     = Math.round(kpis.ocupacionPromedio * 100);
  const varOcupPct  = Math.round(Math.abs(kpis.variacionOcupacion * 100)) / 100;
  const varOcupPos  = kpis.variacionOcupacion >= 0;

  const totalViajes        = departamentos.reduce((s, d) => s + d.viajes,         0);
  const totalAsientosUsados = departamentos.reduce((s, d) => s + d.asientosUsados, 0);
  const totalAsientosVacios = departamentos.reduce((s, d) => s + d.asientosVacios, 0);
  const totalTotal          = departamentos.reduce((s, d) => s + d.total,          0);

  return (
    <Html lang="es">
      <Head />
      <Preview>Resumen mensual de operaciones — {mes} — {companyName}</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── 1. HEADER ─────────────────────────────────────────────── */}
          <Section style={header}>
            <Row>
              <Column style={{ textAlign: "center" as const }}>
                <div style={logoBg}>
                  <Img
                    src={`${process.env.NEXT_PUBLIC_APP_URL}/HarborLogo.png`}
                    width="36"
                    height="36"
                    alt="HarborFlow"
                    style={{ display: "inline-block", borderRadius: "50%", verticalAlign: "middle" }}
                  />
                </div>
                <Text style={brandText}>HarborFlow</Text>
              </Column>
            </Row>
          </Section>

          {/* ── 2. TÍTULO ─────────────────────────────────────────────── */}
          <Section style={bodyCard}>
            <Text style={titleText}>Resumen consolidado — {mes}</Text>
            <Text style={subtitleText}>
              Resumen mensual de operaciones de transporte. {companyName}.
            </Text>

            {/* ── KPI GRID 2×2 ──────────────────────────────────────── */}
            <Row style={kpiRowGap}>
              <Column style={kpiCard}>
                <Text style={kpiLabel}>VIAJES REALIZADOS</Text>
                <Text style={kpiValue}>{kpis.totalViajes}</Text>
                <Variacion value={kpis.variacionViajes} />
              </Column>
              <Column style={kpiGap} />
              <Column style={kpiCard}>
                <Text style={kpiLabel}>OCUPACIÓN PROMEDIO</Text>
                <Text style={kpiValue}>{ocupPct}%</Text>
                {kpis.variacionOcupacion !== 0 && (
                  <Text style={{ ...varText, color: varOcupPos ? "#15803d" : "#b91c1c" }}>
                    {varOcupPos ? "↑" : "↓"} {varOcupPct} pp vs mes anterior
                  </Text>
                )}
              </Column>
            </Row>

            <div style={{ height: 8 }} />

            <Row style={kpiRowGap}>
              <Column style={kpiCard}>
                <Text style={kpiLabel}>PASAJEROS TRANSPORTADOS</Text>
                <Text style={kpiValue}>{kpis.totalPasajeros}</Text>
                <Variacion value={kpis.variacionPasajeros} />
              </Column>
              <Column style={kpiGap} />
              <Column style={kpiCard}>
                <Text style={kpiLabel}>ASIENTOS LIQUIDADOS</Text>
                <Text style={kpiValue}>{kpis.asientosLiquidados.toFixed(2)}</Text>
                <Text style={kpiNote}>incluye vacíos proporcionales</Text>
              </Column>
            </Row>

            {/* ── TABLA POR DEPARTAMENTO ────────────────────────────── */}
            <Text style={sectionLabel}>DISTRIBUCIÓN POR DEPARTAMENTO</Text>
            <table style={tableCss} cellPadding={0} cellSpacing={0}>
              <thead>
                <tr>
                  <th style={thLeft}>Departamento</th>
                  <th style={thRight}>Viajes</th>
                  <th style={thRight}>Asientos usados</th>
                  <th style={thRight}>Vacíos</th>
                  <th style={thRight}>Total</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map((d) => (
                  <tr key={d.name} style={trRow}>
                    <td style={tdLeft}>{d.name}</td>
                    <td style={tdRight}>{d.viajes}</td>
                    <td style={tdRight}>{d.asientosUsados}</td>
                    <td style={tdRight}>{d.asientosVacios.toFixed(2)}</td>
                    <td style={tdRight}>{d.total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={trTotal}>
                  <td style={tdTotalLabel}>TOTAL</td>
                  <td style={tdTotalValue}>{totalViajes}</td>
                  <td style={tdTotalValue}>{totalAsientosUsados}</td>
                  <td style={tdTotalValue}>{totalAsientosVacios.toFixed(2)}</td>
                  <td style={tdTotalValue}>{totalTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* ── DESTACADOS DEL MES ───────────────────────────────── */}
            <Text style={sectionLabel}>DESTACADOS DEL MES</Text>
            <Row>
              <Column style={destacadoCard}>
                <Text style={destacadoEyebrow}>Departamento con más viajes</Text>
                <Text style={destacadoName}>{destacados.masViajes.name}</Text>
                <Text style={destacadoDetail}>
                  {destacados.masViajes.viajes} viajes · {destacados.masViajes.asientos} asientos
                </Text>
              </Column>
              <Column style={kpiGap} />
              <Column style={destacadoCard}>
                <Text style={destacadoEyebrow}>Mejor ocupación promedio</Text>
                <Text style={destacadoName}>{destacados.mejorOcupacion.name}</Text>
                <Text style={destacadoDetail}>
                  {destacados.mejorOcupacion.ocupacion.toFixed(1)}% de ocupación
                </Text>
              </Column>
            </Row>

            {/* ── OPERACIÓN ─────────────────────────────────────────── */}
            <Text style={sectionLabel}>OPERACIÓN</Text>
            <Row>
              <Column style={opCard}>
                <Text style={opValue}>{operacion.lanchasActivas}</Text>
                <Text style={opLabel}>Lanchas activas</Text>
              </Column>
              <Column style={kpiGap} />
              <Column style={opCard}>
                <Text style={opValue}>{operacion.conductores}</Text>
                <Text style={opLabel}>Conductores</Text>
              </Column>
              <Column style={kpiGap} />
              <Column style={opCard}>
                <Text style={opValue}>{operacion.cancelaciones}</Text>
                <Text style={opLabel}>Cancelaciones</Text>
              </Column>
            </Row>
          </Section>

          {/* ── 3. HERO ───────────────────────────────────────────────── */}
          <Section style={hero}>
            <Text style={eyebrow}>INFORME COMPLETO</Text>
            <Text style={heroTitle}>
              El informe narrativo con análisis IA está disponible en el dashboard
            </Text>
            <Text style={heroSub}>
              Ingresá a HarborFlow para ver el análisis completo
            </Text>
            {/* wave */}
            <div style={{ lineHeight: 0, marginTop: 24 }}>
              <svg
                viewBox="0 0 520 32"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block", width: "100%" }}
              >
                <path
                  d="M0,16 C130,32 390,0 520,16 L520,32 L0,32 Z"
                  fill="#f9fafb"
                />
              </svg>
            </div>
          </Section>

          {/* ── 4. FOOTER ─────────────────────────────────────────────── */}
          <Section style={footer}>
            <Text style={footerText}>HarborFlow — Puerto Rosario</Text>
            <Text style={footerText}>Sistema de gestión operativa portuaria</Text>
            <Text style={{ ...footerText, marginTop: "8px", color: "#9ca3af" }}>
              Este email fue enviado automáticamente al cierre del mes.
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
  maxWidth: "560px",
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

const logoBg: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#1a3560",
  borderRadius: "50%",
  padding: "4px",
  verticalAlign: "middle",
  marginRight: "8px",
};

const brandText: React.CSSProperties = {
  display: "inline-block",
  color: "#f0f6ff",
  fontSize: "18px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  margin: 0,
  verticalAlign: "middle",
};

const bodyCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "28px 36px",
};

const titleText: React.CSSProperties = {
  color: "#0d1b35",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 6px",
};

const subtitleText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 24px",
};

const kpiRowGap: React.CSSProperties = { margin: 0 };

const kpiCard: React.CSSProperties = {
  backgroundColor: "#f0f6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  padding: "14px 16px",
};

const kpiGap: React.CSSProperties = { width: 8, minWidth: 8 };

const kpiLabel: React.CSSProperties = {
  color: "#1d4ed8",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  margin: "0 0 6px",
};

const kpiValue: React.CSSProperties = {
  color: "#0d1b35",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 2px",
  lineHeight: "1.2",
};

const kpiNote: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "11px",
  fontStyle: "italic",
  margin: 0,
};

const varText: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  margin: 0,
};

const sectionLabel: React.CSSProperties = {
  color: "#374151",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  margin: "24px 0 10px",
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "6px",
};

// -- Table styles (inline for email) --

const tableCss: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "12px",
  marginBottom: "8px",
};

const thLeft: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  color: "#6b7280",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "8px 12px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
};

const thRight: React.CSSProperties = {
  ...thLeft,
  textAlign: "right",
};

const trRow: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
};

const tdLeft: React.CSSProperties = {
  color: "#0d1b35",
  fontWeight: 600,
  padding: "8px 12px",
  textAlign: "left",
};

const tdRight: React.CSSProperties = {
  color: "#374151",
  fontWeight: 500,
  padding: "8px 12px",
  textAlign: "right",
};

const trTotal: React.CSSProperties = {
  backgroundColor: "#0d1b35",
};

const tdTotalLabel: React.CSSProperties = {
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "11px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "8px 12px",
  textAlign: "left",
};

const tdTotalValue: React.CSSProperties = {
  color: "#ffffff",
  fontWeight: 700,
  padding: "8px 12px",
  textAlign: "right",
};

// -- Destacados --

const destacadoCard: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "14px 16px",
};

const destacadoEyebrow: React.CSSProperties = {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  margin: "0 0 4px",
};

const destacadoName: React.CSSProperties = {
  color: "#0d1b35",
  fontSize: "15px",
  fontWeight: 700,
  margin: "0 0 2px",
};

const destacadoDetail: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  margin: 0,
};

// -- Operación --

const opCard: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "12px 14px",
  textAlign: "center",
};

const opValue: React.CSSProperties = {
  color: "#0d1b35",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 2px",
};

const opLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "11px",
  margin: 0,
};

// -- Hero --

const hero: React.CSSProperties = {
  backgroundColor: "#0d1b35",
  padding: "32px 36px 0",
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

// -- Footer --

const footer: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  padding: "18px 36px",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  margin: "2px 0",
  lineHeight: "1.5",
};
