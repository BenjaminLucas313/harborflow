import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConductorEmailProps {
  nombre:       string;
  tripId:       string;
  fecha:        string;        // "Martes 29 de abril, 07:30 hs"
  lancha:       string;        // "Lancha Río Paraná — 10 asientos"
  ruta:         string;        // "Puerto Rosario → Terminal Norte"
  pasajeros:    Array<{ nombre: string; departamento: string }>;
  checklistUrl: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConductorEmail({
  nombre,
  fecha,
  lancha,
  ruta,
  pasajeros,
  checklistUrl,
}: ConductorEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Fuiste asignado a un nuevo viaje — {fecha}</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── 1. HEADER ─────────────────────────────────────────────────── */}
          <Section style={header}>
            <table width="100%" cellPadding="0" cellSpacing="0">
              <tbody>
                <tr>
                  <td align="center" style={{ lineHeight: 1, padding: "20px 32px" }}>
                    <Img
                      src={`${process.env.NEXT_PUBLIC_APP_URL}/HarborLogo.png`}
                      width="26"
                      height="26"
                      alt="HarborFlow"
                      style={{ borderRadius: "50%", verticalAlign: "middle", display: "inline-block", marginRight: "8px" }}
                    />
                    <span style={brandText}>HarborFlow</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── 2. BODY ───────────────────────────────────────────────────── */}
          <Section style={bodyCard}>

            {/* Greeting */}
            <Text style={greeting}>¡Hola, {nombre}!</Text>
            <Text style={subtitleStyle}>
              Fuiste asignado a un nuevo viaje. A continuación encontrás los detalles y la lista de pasajeros.
            </Text>

            {/* Trip info box */}
            <div style={infoBox}>
              <Text style={infoBoxTitle}>DETALLES DEL VIAJE</Text>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td width="28" style={{ verticalAlign: "top", fontSize: "15px", paddingTop: "2px" }}>📅</td>
                    <td style={{ paddingBottom: "8px", fontSize: "13px", color: "#374151" }}>
                      <span style={infoLabel}>Fecha y hora</span>
                      <span style={infoSep}> → </span>
                      <span style={infoValue}>{fecha}</span>
                    </td>
                  </tr>
                  <tr>
                    <td width="28" style={{ verticalAlign: "top", fontSize: "15px", paddingTop: "2px" }}>🚢</td>
                    <td style={{ paddingBottom: "8px", fontSize: "13px", color: "#374151" }}>
                      <span style={infoLabel}>Embarcación</span>
                      <span style={infoSep}> → </span>
                      <span style={infoValue}>{lancha}</span>
                    </td>
                  </tr>
                  <tr>
                    <td width="28" style={{ verticalAlign: "top", fontSize: "15px", paddingTop: "2px" }}>🕒</td>
                    <td style={{ fontSize: "13px", color: "#374151" }}>
                      <span style={infoLabel}>Ruta</span>
                      <span style={infoSep}> → </span>
                      <span style={infoValue}>{ruta}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Passengers heading */}
            <Text style={passengerTitle}>Revisá quién debe viajar con vos</Text>
            <Text style={passengerSubtitle}>
              Estos son los pasajeros confirmados al momento del envío.
            </Text>

            {/* Passenger list */}
            {pasajeros.length === 0 ? (
              <div style={emptyBox}>
                <Text style={{ margin: 0, color: "#6b7280", fontSize: "13px", textAlign: "center" }}>
                  Los pasajeros se confirmarán antes del viaje.
                </Text>
              </div>
            ) : (
              <table width="100%" cellPadding="0" cellSpacing="0" style={passengerTable}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={thStyle}>Pasajero</th>
                    <th style={thStyle}>Departamento</th>
                  </tr>
                </thead>
                <tbody>
                  {pasajeros.map((p, i) => (
                    <tr key={i} style={i % 2 !== 0 ? { backgroundColor: "#f9fafb" } : {}}>
                      <td style={tdStyle}>
                        <span style={avatarCircle}>{getInitials(p.nombre)}</span>
                        {p.nombre}
                      </td>
                      <td style={tdStyle}>
                        <span style={deptBadge}>{p.departamento}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* ── 3. HERO ───────────────────────────────────────────────────── */}
          <Section style={heroStyle}>
            <Text style={eyebrow}>YA PODÉS COMENZAR</Text>
            <Text style={heroTitle}>
              Accedé al checklist del viaje{"\n"}y marcá quién abordó
            </Text>
            <Button href={checklistUrl} style={heroBtn}>
              Ver checklist del viaje →
            </Button>
          </Section>

          {/* ── 4. NOTICE ─────────────────────────────────────────────────── */}
          <Section style={noticeStyle}>
            <Text style={noticeText}>
              Recibirás este email cada vez que seas asignado a un viaje. La lista de pasajeros puede actualizarse hasta el momento de la salida.
            </Text>
          </Section>

          {/* ── 5. FOOTER ─────────────────────────────────────────────────── */}
          <Section style={footerStyle}>
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
  fontFamily:      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin:          0,
  padding:         0,
};

const container: React.CSSProperties = {
  maxWidth:        "520px",
  margin:          "40px auto",
  backgroundColor: "#ffffff",
  borderRadius:    "12px",
  overflow:        "hidden",
};

const header: React.CSSProperties = {
  backgroundColor: "#0d1b35",
};

const brandText: React.CSSProperties = {
  color:          "#f0f6ff",
  fontSize:       "18px",
  fontWeight:     700,
  letterSpacing:  "0.04em",
  verticalAlign:  "middle",
};

const bodyCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding:         "28px 36px",
};

const greeting: React.CSSProperties = {
  color:      "#0d1b35",
  fontSize:   "19px",
  fontWeight: 700,
  margin:     "0 0 8px",
};

const subtitleStyle: React.CSSProperties = {
  color:      "#374151",
  fontSize:   "14px",
  lineHeight: "1.6",
  margin:     "0 0 20px",
};

const infoBox: React.CSSProperties = {
  backgroundColor: "#f0f6ff",
  border:          "1px solid #bfdbfe",
  borderRadius:    "8px",
  padding:         "14px 18px",
  marginBottom:    "20px",
};

const infoBoxTitle: React.CSSProperties = {
  color:          "#1e40af",
  fontSize:       "10px",
  fontWeight:     700,
  letterSpacing:  "0.1em",
  textTransform:  "uppercase",
  margin:         "0 0 10px",
};

const infoLabel: React.CSSProperties = {
  color:      "#6b7280",
  fontWeight: 500,
};

const infoSep: React.CSSProperties = {
  color: "#9ca3af",
};

const infoValue: React.CSSProperties = {
  color:      "#111827",
  fontWeight: 600,
};

const passengerTitle: React.CSSProperties = {
  color:      "#0d1b35",
  fontSize:   "14px",
  fontWeight: 700,
  margin:     "0 0 4px",
};

const passengerSubtitle: React.CSSProperties = {
  color:    "#6b7280",
  fontSize: "12px",
  margin:   "0 0 12px",
};

const emptyBox: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border:          "1px dashed #e5e7eb",
  borderRadius:    "8px",
  padding:         "16px",
  textAlign:       "center",
};

const passengerTable: React.CSSProperties = {
  borderCollapse: "collapse",
  width:          "100%",
  border:         "1px solid #e5e7eb",
  borderRadius:   "8px",
  overflow:       "hidden",
  fontSize:       "13px",
};

const thStyle: React.CSSProperties = {
  padding:       "8px 12px",
  textAlign:     "left",
  fontSize:      "10px",
  fontWeight:    700,
  color:         "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom:  "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding:     "9px 12px",
  color:       "#374151",
  fontSize:    "13px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "middle",
};

const avatarCircle: React.CSSProperties = {
  display:         "inline-flex",
  alignItems:      "center",
  justifyContent:  "center",
  width:           "24px",
  height:          "24px",
  borderRadius:    "50%",
  backgroundColor: "#dbeafe",
  color:           "#1d4ed8",
  fontSize:        "10px",
  fontWeight:      700,
  marginRight:     "8px",
  verticalAlign:   "middle",
};

const deptBadge: React.CSSProperties = {
  display:         "inline-block",
  backgroundColor: "#f0f6ff",
  color:           "#1d4ed8",
  fontSize:        "11px",
  fontWeight:      600,
  padding:         "2px 8px",
  borderRadius:    "4px",
};

const heroStyle: React.CSSProperties = {
  backgroundColor: "#0d1b35",
  padding:         "32px 36px",
  textAlign:       "center",
};

const eyebrow: React.CSSProperties = {
  color:          "#7eb8f5",
  fontSize:       "11px",
  fontWeight:     700,
  letterSpacing:  "0.12em",
  textTransform:  "uppercase",
  margin:         "0 0 8px",
};

const heroTitle: React.CSSProperties = {
  color:      "#ffffff",
  fontSize:   "18px",
  fontWeight: 700,
  lineHeight: "1.4",
  margin:     "0 0 20px",
  whiteSpace: "pre-line",
};

const heroBtn: React.CSSProperties = {
  display:         "inline-block",
  backgroundColor: "#ffffff",
  color:           "#0d1b35",
  fontSize:        "14px",
  fontWeight:      700,
  padding:         "12px 28px",
  borderRadius:    "8px",
  textDecoration:  "none",
};

const noticeStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderTop:       "1px solid #e5e7eb",
  padding:         "16px 36px",
};

const noticeText: React.CSSProperties = {
  color:      "#6b7280",
  fontSize:   "12px",
  lineHeight: "1.6",
  margin:     0,
  textAlign:  "center",
};

const footerStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  padding:         "20px 36px",
  textAlign:       "center",
};

const footerText: React.CSSProperties = {
  color:      "#6b7280",
  fontSize:   "12px",
  margin:     "2px 0",
  lineHeight: "1.5",
};
