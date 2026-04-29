// =============================================================================
// PlanillaPasajerosPdf.tsx — Passenger roster PDF for pre-departure use
// =============================================================================
//
// SERVER-ONLY — rendered exclusively in API routes via renderToBuffer.
// Never import this in a "use client" component or page.
//
// Layout (A4):
//   Header      — dark navy bar with anchor logo + title + date
//   Trip info   — 3-column grid (boat, departure, seat count)
//   Recorrido   — vertical stop timeline (only if stops exist)
//   Table       — numbered list with dept badge, checkbox, signature line
//   Footer      — branding + conductor name (fixed, repeats on each page)
//
// =============================================================================

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Line,
  Path,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StopEntry = {
  order: number;
  name:  string;
};

export type ConfirmedSlot = {
  id:               string;
  usuarioFirstName: string;
  usuarioLastName:  string;
  departmentName:   string;
};

export type PlanillaData = {
  departureTime:        Date;
  estimatedArrivalTime: Date | null;
  capacity:             number;
  boat:                 { name: string };
  driver:               { firstName: string; lastName: string } | null;
  branch:               { name: string };
  stops:                StopEntry[];
};

type Props = {
  trip:        PlanillaData;
  slots:       ConfirmedSlot[];
  generatedAt: Date;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ARG_TZ = "America/Argentina/Buenos_Aires";

function fmtDateFull(d: Date): string {
  const str = d.toLocaleDateString("es-AR", {
    timeZone: ARG_TZ,
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fmtTime(d: Date): string {
  return (
    d.toLocaleTimeString("es-AR", {
      timeZone: ARG_TZ,
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    }) + " hs"
  );
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("es-AR", {
    timeZone: ARG_TZ,
    day:      "2-digit",
    month:    "2-digit",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
}

function padN(n: number): string {
  return String(n).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const C = {
  navyDark:  "#0d1b35",
  navyMid:   "#1a3560",
  primary:   "#1d4ed8",   // blue-700
  blueBg:    "#dbeafe",   // blue-100
  white:     "#ffffff",
  black:     "#111827",   // gray-900
  gray50:    "#f9fafb",
  gray100:   "#f3f4f6",
  gray200:   "#e5e7eb",
  gray300:   "#d1d5db",
  gray400:   "#9ca3af",
  gray500:   "#6b7280",
  green:     "#22c55e",   // timeline start dot
  blue:      "#3b82f6",   // timeline end dot
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical:   36,
    paddingBottom:     60,   // reserve space for fixed footer
    fontFamily:        "Helvetica",
    fontSize:          9,
    color:             C.black,
    backgroundColor:   C.white,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor:   C.navyDark,
    marginHorizontal:  -40,
    marginTop:         -36,
    paddingHorizontal: 40,
    paddingVertical:   14,
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    marginBottom:      18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  logoBg: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: C.navyMid,
    alignItems:      "center",
    justifyContent:  "center",
    marginRight:     8,
  },
  headerBrand: {
    color:      C.white,
    fontSize:   13,
    fontFamily: "Helvetica-Bold",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerTitle: {
    color:      C.white,
    fontSize:   11,
    fontFamily: "Helvetica-Bold",
    opacity:    0.95,
  },
  headerDate: {
    color:      C.white,
    fontSize:   8,
    opacity:    0.7,
    marginTop:  2,
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize:      7,
    fontFamily:    "Helvetica-Bold",
    color:         C.gray400,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom:  5,
    marginTop:     14,
  },

  // ── Trip info grid ───────────────────────────────────────────────────────
  infoGrid: {
    flexDirection:   "row",
    backgroundColor: C.gray50,
    borderRadius:    5,
    paddingVertical: 12,
  },
  infoCol: {
    flex:           1,
    paddingLeft:    14,
    paddingRight:   8,
  },
  infoColBorder: {
    borderLeft:       "1 solid #e5e7eb",
  },
  infoKey: {
    fontSize:      7,
    fontFamily:    "Helvetica-Bold",
    color:         C.gray500,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom:  3,
  },
  infoVal: {
    fontSize:    11,
    fontFamily:  "Helvetica-Bold",
    color:       C.black,
  },
  infoSub: {
    fontSize:  8,
    color:     C.gray400,
    marginTop: 2,
  },

  // ── Stops timeline ───────────────────────────────────────────────────────
  stopRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    minHeight:     18,
  },
  stopSpine: {
    width:       18,
    alignItems:  "center",
  },
  stopDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    1,
  },
  stopLine: {
    width:           1,
    flex:            1,
    backgroundColor: C.gray300,
    minHeight:       10,
    marginTop:       2,
  },
  stopName: {
    flex:       1,
    fontSize:   9,
    paddingLeft: 6,
    paddingBottom: 8,
    color:      C.black,
  },

  // ── Passenger table ──────────────────────────────────────────────────────
  tableHeader: {
    flexDirection:     "row",
    backgroundColor:   C.gray50,
    paddingHorizontal: 8,
    paddingVertical:   5,
    borderTopWidth:    1,
    borderTopColor:    C.gray200,
    borderBottomWidth: 1,
    borderBottomColor: C.gray300,
  },
  thCell: {
    fontSize:      7,
    fontFamily:    "Helvetica-Bold",
    color:         C.gray500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection:     "row",
    paddingHorizontal: 8,
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: C.gray200,
    alignItems:        "center",
    minHeight:         28,
  },
  tableRowAlt: {
    backgroundColor: C.gray50,
  },
  tdCell: {
    fontSize: 9,
    color:    C.black,
  },

  // Column widths (content area = 515pt)
  colNum:   { width: 28 },
  colName:  { flex: 1 },
  colDept:  { width: 128 },
  colCheck: { width: 55, alignItems: "center" },
  colSign:  { width: 90 },

  // Dept badge
  deptBadge: {
    backgroundColor:  C.blueBg,
    borderRadius:     3,
    paddingHorizontal: 5,
    paddingVertical:  1,
    alignSelf:        "flex-start",
  },
  deptBadgeText: {
    color:      C.primary,
    fontSize:   7,
    fontFamily: "Helvetica-Bold",
  },

  // Checkbox
  checkbox: {
    width:        13,
    height:       13,
    borderWidth:  1,
    borderColor:  C.gray400,
    borderRadius: 2,
  },

  // Signature line
  signLine: {
    borderBottom: "1 solid #9ca3af",
    width:        75,
    marginTop:    8,
  },

  // ── Footer (fixed → repeats on all pages) ────────────────────────────────
  footer: {
    position:       "absolute",
    bottom:         20,
    left:           40,
    right:          40,
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-end",
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    paddingTop:     6,
  },
  footerLeft: {
    flexDirection: "column",
  },
  footerBrand: {
    fontSize:   7,
    fontFamily: "Helvetica-Bold",
    color:      C.gray400,
  },
  footerSub: {
    fontSize:  6,
    color:     C.gray400,
    marginTop: 1,
  },
  footerRight: {
    alignItems: "flex-end",
  },
  footerLabel: {
    fontSize:  6,
    color:     C.gray400,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerDriver: {
    fontSize:   8,
    fontFamily: "Helvetica-Bold",
    color:      C.black,
    marginTop:  1,
  },
});

// ---------------------------------------------------------------------------
// Anchor SVG logo (Lucide anchor icon)
// ---------------------------------------------------------------------------

function AnchorIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Circle
        cx="12" cy="5" r="3"
        fill="none" stroke={C.white}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Line
        x1="12" y1="8" x2="12" y2="22"
        stroke={C.white} strokeWidth={2} strokeLinecap="round"
      />
      <Path
        d="M5 15H2a10 10 0 0 0 20 0h-3"
        fill="none" stroke={C.white}
        strokeWidth={2} strokeLinecap="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlanillaPasajerosPdf({ trip, slots, generatedAt }: Props) {
  const free         = Math.max(0, trip.capacity - slots.length);
  const driverName   = trip.driver
    ? `${trip.driver.firstName} ${trip.driver.lastName}`
    : null;

  return (
    <Document
      title={`Planilla de Pasajeros — ${trip.boat.name}`}
      author="HarborFlow"
      subject="Planilla de pasajeros para embarque"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.logoBg}>
              <AnchorIcon />
            </View>
            <Text style={s.headerBrand}>HarborFlow</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>Planilla de pasajeros</Text>
            <Text style={s.headerDate}>{fmtDateFull(trip.departureTime)}</Text>
          </View>
        </View>

        {/* ── Trip info ────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Datos del viaje</Text>
        <View style={s.infoGrid}>
          {/* Embarcación */}
          <View style={s.infoCol}>
            <Text style={s.infoKey}>Embarcación</Text>
            <Text style={s.infoVal}>{trip.boat.name}</Text>
            <Text style={s.infoSub}>Capacidad: {trip.capacity} asientos</Text>
          </View>

          {/* Hora de salida */}
          <View style={[s.infoCol, s.infoColBorder]}>
            <Text style={s.infoKey}>Hora de salida</Text>
            <Text style={s.infoVal}>{fmtTime(trip.departureTime)}</Text>
            {trip.estimatedArrivalTime && (
              <Text style={s.infoSub}>
                Llegada est.: {fmtTime(trip.estimatedArrivalTime)}
              </Text>
            )}
          </View>

          {/* Pasajeros */}
          <View style={[s.infoCol, s.infoColBorder]}>
            <Text style={s.infoKey}>Pasajeros confirmados</Text>
            <Text style={s.infoVal}>{slots.length} / {trip.capacity}</Text>
            <Text style={s.infoSub}>
              {free} asiento{free !== 1 ? "s" : ""} libre{free !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* ── Stops timeline (only if stops exist) ─────────────────────── */}
        {trip.stops.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Recorrido</Text>
            <View>
              {trip.stops.map((stop, i) => {
                const isFirst = i === 0;
                const isLast  = i === trip.stops.length - 1;
                const dotColor = isFirst ? C.green : isLast ? C.blue : C.gray400;

                return (
                  <View key={stop.order} style={s.stopRow}>
                    <View style={s.stopSpine}>
                      <View style={[s.stopDot, { backgroundColor: dotColor }]} />
                      {!isLast && <View style={s.stopLine} />}
                    </View>
                    <Text style={s.stopName}>{stop.name}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Passenger table ──────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>
          Lista de pasajeros ({slots.length})
        </Text>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={[s.thCell, s.colNum]}>#</Text>
          <Text style={[s.thCell, s.colName]}>Pasajero</Text>
          <Text style={[s.thCell, s.colDept]}>Departamento</Text>
          <Text style={[s.thCell, s.colCheck]}>Abordó</Text>
          <Text style={[s.thCell, s.colSign]}>Firma</Text>
        </View>

        {slots.length === 0 ? (
          <View style={{ paddingVertical: 12, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 9, color: C.gray400 }}>
              Sin pasajeros confirmados para este viaje.
            </Text>
          </View>
        ) : (
          slots.map((slot, idx) => (
            <View
              key={slot.id}
              style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}
              wrap={false}
            >
              {/* # */}
              <Text style={[s.tdCell, s.colNum, { color: C.gray400, fontFamily: "Helvetica-Bold" }]}>
                {padN(idx + 1)}
              </Text>

              {/* Pasajero */}
              <Text style={[s.tdCell, s.colName]}>
                {slot.usuarioLastName}, {slot.usuarioFirstName}
              </Text>

              {/* Departamento */}
              <View style={s.colDept}>
                <View style={s.deptBadge}>
                  <Text style={s.deptBadgeText}>{slot.departmentName}</Text>
                </View>
              </View>

              {/* Abordó (empty checkbox) */}
              <View style={[s.colCheck, { alignItems: "center" }]}>
                <View style={s.checkbox} />
              </View>

              {/* Firma (empty signature line) */}
              <View style={s.colSign}>
                <View style={s.signLine} />
              </View>
            </View>
          ))
        )}

        {/* ── Footer (fixed — appears on every page) ───────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerBrand}>HarborFlow — {trip.branch.name}</Text>
            <Text style={s.footerSub}>
              Documento generado automáticamente · No requiere sello
            </Text>
            <Text style={[s.footerSub, { marginTop: 2 }]}>
              Generado: {fmtDateTime(generatedAt)}
            </Text>
          </View>
          <View style={s.footerRight}>
            <Text style={s.footerLabel}>Conductor responsable</Text>
            <Text style={s.footerDriver}>
              {driverName ?? "Sin conductor asignado"}
            </Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
