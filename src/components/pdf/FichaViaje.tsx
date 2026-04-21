// =============================================================================
// FichaViaje.tsx — Trip manifest PDF
// =============================================================================
//
// SERVER-ONLY component — rendered exclusively in API routes via renderToBuffer.
// Never import this in a "use client" component or page.
//
// Layout (A4):
//   Header bar  — system name + "FICHA DE VIAJE"
//   Trip data   — boat, driver, branch, date, departure time
//   Passenger table — rows grouped by department, sorted alphabetically
//   Summary     — occupied/empty seats + proportional liquidation if available
//   Footer      — generation timestamp
//
// =============================================================================

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotEntry = {
  id:                string;
  status:            string;
  departmentId:      string;
  departmentName:    string;
  usuarioFirstName:  string;
  usuarioLastName:   string;
  workTypeName:      string;
  workTypeCode:      string;
  representedCompany: string;
};

export type LiqEntry = {
  departamentoId:     string;
  departamentoNombre: string;
  totalAsientos:      number;
  asientosReservados: number;
};

export type TripData = {
  id:            string;
  departureTime: Date;
  capacity:      number;
  status:        string;
  boat:          { name: string };
  driver:        { firstName: string; lastName: string } | null;
  branch:        { name: string };
};

type Props = {
  trip:         TripData;
  slots:        SlotEntry[];
  liquidacion?: LiqEntry[];
  generatedAt:  Date;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ARG_TZ = "America/Argentina/Buenos_Aires";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    timeZone: ARG_TZ,
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    timeZone: ARG_TZ,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
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

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmado",
  PENDING:   "Pendiente",
  REJECTED:  "Rechazado",
  CANCELLED: "Cancelado",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const C = {
  primary:   "#1e40af",  // blue-800
  white:     "#ffffff",
  black:     "#111827",
  gray1:     "#f3f4f6",  // gray-100
  gray2:     "#e5e7eb",  // gray-200
  gray3:     "#9ca3af",  // gray-400
  gray4:     "#6b7280",  // gray-500
  green:     "#065f46",  // emerald-800
  amber:     "#92400e",  // amber-800
  border:    "#d1d5db",  // gray-300
};

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical:   36,
    fontFamily:        "Helvetica",
    fontSize:          9,
    color:             C.black,
    backgroundColor:   C.white,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.primary,
    marginHorizontal: -40,
    marginTop:        -36,
    paddingHorizontal: 40,
    paddingVertical:   14,
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    marginBottom:      20,
  },
  headerSystem: {
    color:     C.white,
    fontSize:  10,
    fontFamily: "Helvetica-Bold",
    opacity:   0.85,
  },
  headerTitle: {
    color:     C.white,
    fontSize:  16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },

  // ── Section labels ───────────────────────────────────────────────────────
  sectionLabel: {
    fontSize:    7,
    fontFamily:  "Helvetica-Bold",
    color:       C.gray3,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom:  4,
    marginTop:     14,
  },

  // ── Trip info grid ───────────────────────────────────────────────────────
  infoGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    backgroundColor: C.gray1,
    borderRadius:    4,
    padding:         12,
    gap:             0,
  },
  infoCell: {
    width:         "50%",
    paddingBottom: 6,
  },
  infoKey: {
    fontSize:    7,
    fontFamily:  "Helvetica-Bold",
    color:       C.gray4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom:  2,
  },
  infoVal: {
    fontSize:    10,
    fontFamily:  "Helvetica-Bold",
    color:       C.black,
  },

  // ── Passenger table ──────────────────────────────────────────────────────
  deptBlock: {
    marginTop: 10,
  },
  deptHeader: {
    backgroundColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical:   5,
    borderTopLeftRadius:  3,
    borderTopRightRadius: 3,
  },
  deptHeaderText: {
    color:      C.white,
    fontSize:   8,
    fontFamily: "Helvetica-Bold",
  },
  tableHeader: {
    flexDirection:   "row",
    backgroundColor: C.gray2,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableHeaderCell: {
    fontSize:   7,
    fontFamily: "Helvetica-Bold",
    color:      C.gray4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection:   "row",
    paddingHorizontal: 8,
    paddingVertical:   5,
    borderBottomWidth: 1,
    borderBottomColor: C.gray2,
  },
  tableRowAlt: {
    backgroundColor: C.gray1,
  },
  tableCell: {
    fontSize: 9,
    color:    C.black,
  },
  // Column widths
  colN:       { width: "5%"  },
  colName:    { width: "35%" },
  colWork:    { width: "32%" },
  colStatus:  { width: "28%", textAlign: "right" },

  statusConfirmed: { color: C.green,  fontFamily: "Helvetica-Bold" },
  statusPending:   { color: C.amber,  fontFamily: "Helvetica-Bold" },
  statusOther:     { color: C.gray4 },

  // ── Summary ──────────────────────────────────────────────────────────────
  summaryBox: {
    backgroundColor: C.gray1,
    borderRadius:    4,
    padding:         12,
    marginTop:       14,
    flexDirection:   "row",
    flexWrap:        "wrap",
  },
  summaryItem: {
    width:         "33.33%",
    paddingBottom: 6,
  },
  summaryKey: {
    fontSize:    7,
    color:       C.gray4,
    fontFamily:  "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom:  2,
  },
  summaryVal: {
    fontSize:    12,
    fontFamily:  "Helvetica-Bold",
    color:       C.black,
  },
  summaryValSmall: {
    fontSize:    10,
    fontFamily:  "Helvetica-Bold",
    color:       C.primary,
  },

  liqTable: { marginTop: 8 },
  liqRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.gray2,
  },
  liqDept:    { fontSize: 9, flex: 1 },
  liqSeats:   { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right", width: 80 },
  liqPct:     { fontSize: 9, color: C.gray4, textAlign: "right", width: 50 },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position:   "absolute",
    bottom:     24,
    left:       40,
    right:      40,
    flexDirection:  "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop:     6,
  },
  footerText: {
    fontSize: 7,
    color:    C.gray3,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FichaViajePdf({ trip, slots, liquidacion, generatedAt }: Props) {
  // Group active slots by department, sorted by dept name then passenger name.
  const activeSlots = slots.filter((s) => s.status !== "CANCELLED");

  const deptMap = new Map<string, SlotEntry[]>();
  for (const slot of activeSlots) {
    const list = deptMap.get(slot.departmentId) ?? [];
    list.push(slot);
    deptMap.set(slot.departmentId, list);
  }

  // Sort departments by name.
  const sortedDepts = Array.from(deptMap.entries()).sort(([, a], [, b]) =>
    (a[0]?.departmentName ?? "").localeCompare(b[0]?.departmentName ?? "", "es"),
  );

  const occupied = activeSlots.filter(
    (s) => s.status === "CONFIRMED" || s.status === "PENDING",
  ).length;
  const free = Math.max(0, trip.capacity - occupied);
  const occupancyPct = trip.capacity > 0
    ? Math.round((occupied / trip.capacity) * 100)
    : 0;

  const driverName = trip.driver
    ? `${trip.driver.firstName} ${trip.driver.lastName}`
    : "Sin asignar";

  return (
    <Document
      title={`Ficha de Viaje — ${trip.boat.name}`}
      author="HarborFlow"
      subject="Manifiesto de pasajeros"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerSystem}>HarborFlow</Text>
          <Text style={s.headerTitle}>FICHA DE VIAJE</Text>
        </View>

        {/* ── Trip information grid ────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Datos del viaje</Text>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoKey}>Lancha</Text>
            <Text style={s.infoVal}>{trip.boat.name}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoKey}>Chofer</Text>
            <Text style={s.infoVal}>{driverName}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoKey}>Puerto</Text>
            <Text style={s.infoVal}>{trip.branch.name}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoKey}>Fecha</Text>
            <Text style={s.infoVal}>{fmtDate(trip.departureTime)}</Text>
          </View>
          <View style={[s.infoCell, { paddingBottom: 0 }]}>
            <Text style={s.infoKey}>Hora de salida</Text>
            <Text style={s.infoVal}>{fmtTime(trip.departureTime)}</Text>
          </View>
          <View style={[s.infoCell, { paddingBottom: 0 }]}>
            <Text style={s.infoKey}>Capacidad</Text>
            <Text style={s.infoVal}>{occupied} / {trip.capacity} asientos</Text>
          </View>
        </View>

        {/* ── Passenger table ──────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>
          Lista de pasajeros ({activeSlots.length})
        </Text>

        {sortedDepts.length === 0 ? (
          <Text style={{ fontSize: 9, color: C.gray4, marginTop: 4 }}>
            Sin pasajeros registrados para este viaje.
          </Text>
        ) : (
          sortedDepts.map(([, deptSlots]) => {
            const deptName = deptSlots[0]?.departmentName ?? "—";
            const sorted = [...deptSlots].sort((a, b) =>
              a.usuarioLastName.localeCompare(b.usuarioLastName, "es"),
            );

            return (
              <View key={deptName} style={s.deptBlock} wrap={false}>
                {/* Department header */}
                <View style={s.deptHeader}>
                  <Text style={s.deptHeaderText}>
                    {deptName.toUpperCase()} — {sorted.length} pasajero{sorted.length !== 1 ? "s" : ""}
                  </Text>
                </View>

                {/* Column headers */}
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, s.colN]}>#</Text>
                  <Text style={[s.tableHeaderCell, s.colName]}>Apellido y nombre</Text>
                  <Text style={[s.tableHeaderCell, s.colWork]}>Tipo de trabajo</Text>
                  <Text style={[s.tableHeaderCell, s.colStatus]}>Estado</Text>
                </View>

                {/* Rows */}
                {sorted.map((slot, idx) => {
                  const statusStyle =
                    slot.status === "CONFIRMED" ? s.statusConfirmed :
                    slot.status === "PENDING"   ? s.statusPending   : s.statusOther;

                  return (
                    <View
                      key={slot.id}
                      style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}
                    >
                      <Text style={[s.tableCell, s.colN]}>{idx + 1}</Text>
                      <Text style={[s.tableCell, s.colName]}>
                        {slot.usuarioLastName}, {slot.usuarioFirstName}
                      </Text>
                      <Text style={[s.tableCell, s.colWork]}>
                        {slot.workTypeName} ({slot.workTypeCode})
                      </Text>
                      <Text style={[s.tableCell, s.colStatus, statusStyle]}>
                        {STATUS_LABEL[slot.status] ?? slot.status}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        {/* ── Summary ──────────────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: 18 }]}>Resumen de ocupación</Text>
        <View style={s.summaryBox}>
          <View style={s.summaryItem}>
            <Text style={s.summaryKey}>Asientos ocupados</Text>
            <Text style={s.summaryVal}>{occupied}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryKey}>Asientos vacios</Text>
            <Text style={s.summaryVal}>{free}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryKey}>Ocupacion</Text>
            <Text style={s.summaryVal}>{occupancyPct}%</Text>
          </View>
        </View>

        {/* ── Proportional distribution (if liquidation calculated) ─────── */}
        {liquidacion && liquidacion.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 14 }]}>
              Distribucion proporcional de asientos
            </Text>
            <View style={s.liqTable}>
              {/* header */}
              <View style={[s.liqRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
                <Text style={[s.liqDept, { fontFamily: "Helvetica-Bold", color: C.gray4, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.5 }]}>
                  Departamento
                </Text>
                <Text style={[s.liqSeats, { fontFamily: "Helvetica-Bold", color: C.gray4, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.5 }]}>
                  Total asientos
                </Text>
                <Text style={[s.liqPct, { fontFamily: "Helvetica-Bold", color: C.gray4, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.5 }]}>
                  % del total
                </Text>
              </View>
              {liquidacion
                .sort((a, b) => a.departamentoNombre.localeCompare(b.departamentoNombre, "es"))
                .map((liq) => {
                  const pct = trip.capacity > 0
                    ? ((liq.totalAsientos / trip.capacity) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <View key={liq.departamentoId} style={s.liqRow}>
                      <Text style={s.liqDept}>{liq.departamentoNombre}</Text>
                      <Text style={s.liqSeats}>{liq.totalAsientos.toFixed(2)}</Text>
                      <Text style={s.liqPct}>{pct}%</Text>
                    </View>
                  );
                })}
              {/* Total */}
              <View style={[s.liqRow, { borderBottomWidth: 0, paddingTop: 5 }]}>
                <Text style={[s.liqDept, { fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
                <Text style={[s.liqSeats, { fontFamily: "Helvetica-Bold" }]}>
                  {liquidacion.reduce((sum, l) => sum + l.totalAsientos, 0).toFixed(2)}
                </Text>
                <Text style={[s.liqPct, { fontFamily: "Helvetica-Bold" }]}>100.0%</Text>
              </View>
            </View>
          </>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Generado: {fmtDateTime(generatedAt)}
          </Text>
          <Text style={s.footerText}>HarborFlow — Manifiesto de pasajeros</Text>
        </View>

      </Page>
    </Document>
  );
}
