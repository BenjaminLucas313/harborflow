// =============================================================================
// ResumenMetricasPdf.tsx — Period liquidation summary PDF
// =============================================================================
//
// SERVER-ONLY component — rendered exclusively in API routes via renderToBuffer.
// Never import this in a "use client" component or page.
//
// Layout (A4, landscape):
//   Header bar  — system name + "RESUMEN DE LIQUIDACIÓN" + period
//   KPI summary — total trips, avg occupancy, unliquidated trips
//   Liquidation table — one row per department with seat totals and status
//   Totals row
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
import type { DeptoResumen, AdminMetrics } from "@/modules/metrics/admin-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResumenMetricasProps = {
  metrics:     AdminMetrics;
  mes:         number;
  anio:        number;
  generatedAt: Date;
  /** Optional department name when the report is filtered to one dept. */
  departamentoNombre?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
] as const;

const ARG_TZ = "America/Argentina/Buenos_Aires";

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

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const C = {
  primary:  "#1e40af",  // blue-800
  white:    "#ffffff",
  black:    "#111827",
  gray1:    "#f3f4f6",  // gray-100
  gray2:    "#e5e7eb",  // gray-200
  gray3:    "#9ca3af",  // gray-400
  gray4:    "#6b7280",  // gray-500
  green:    "#065f46",  // emerald-800
  greenBg:  "#d1fae5",  // emerald-100
  amber:    "#92400e",  // amber-800
  amberBg:  "#fef3c7",  // amber-100
  border:   "#d1d5db",  // gray-300
};

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingVertical:   32,
    fontFamily:        "Helvetica",
    fontSize:          9,
    color:             C.black,
    backgroundColor:   C.white,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor:   C.primary,
    marginHorizontal:  -36,
    marginTop:         -32,
    paddingHorizontal: 36,
    paddingVertical:   14,
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    marginBottom:      18,
  },
  headerLeft: {
    flexDirection: "column",
    gap:           2,
  },
  headerSystem: {
    color:      C.white,
    fontSize:   9,
    fontFamily: "Helvetica-Bold",
    opacity:    0.8,
  },
  headerTitle: {
    color:         C.white,
    fontSize:      15,
    fontFamily:    "Helvetica-Bold",
    letterSpacing: 1,
  },
  headerPeriod: {
    color:      C.white,
    fontSize:   10,
    fontFamily: "Helvetica-Bold",
    opacity:    0.9,
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize:      7,
    fontFamily:    "Helvetica-Bold",
    color:         C.gray3,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom:  6,
    marginTop:     14,
  },

  // ── KPI row ──────────────────────────────────────────────────────────────
  kpiRow: {
    flexDirection: "row",
    gap:           0,
    marginBottom:  2,
  },
  kpiCard: {
    flex:            1,
    backgroundColor: C.gray1,
    borderRadius:    4,
    padding:         10,
    marginRight:     8,
  },
  kpiCardLast: {
    marginRight: 0,
  },
  kpiLabel: {
    fontSize:      7,
    fontFamily:    "Helvetica-Bold",
    color:         C.gray4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom:  4,
  },
  kpiValue: {
    fontSize:   16,
    fontFamily: "Helvetica-Bold",
    color:      C.primary,
  },
  kpiValueAmber: {
    fontSize:   16,
    fontFamily: "Helvetica-Bold",
    color:      C.amber,
  },

  // ── Table ────────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection:   "row",
    backgroundColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical:   5,
    borderRadius:      2,
  },
  tableHeaderCell: {
    fontSize:      7,
    fontFamily:    "Helvetica-Bold",
    color:         C.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection:     "row",
    paddingHorizontal: 8,
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: C.gray2,
    alignItems:        "center",
  },
  tableRowAlt: {
    backgroundColor: C.gray1,
  },
  tableRowTotals: {
    flexDirection:     "row",
    paddingHorizontal: 8,
    paddingVertical:   6,
    borderTopWidth:    2,
    borderTopColor:    C.border,
    backgroundColor:   C.gray1,
    alignItems:        "center",
  },
  tableCell: {
    fontSize: 9,
    color:    C.black,
  },
  tableCellBold: {
    fontSize:   9,
    fontFamily: "Helvetica-Bold",
    color:      C.black,
  },

  // Column widths (A4 portrait: ~515pt usable)
  colDept:       { flex: 3 },
  colConfirm:    { flex: 1.5, textAlign: "right" },
  colPending:    { flex: 1.5, textAlign: "right" },
  colTotal:      { flex: 1.5, textAlign: "right" },
  colViajes:     { flex: 1.2, textAlign: "right" },
  colStatus:     { flex: 1.3, textAlign: "center" },

  // Status badge
  badgeLiquidado: {
    backgroundColor: C.greenBg,
    color:           C.green,
    fontFamily:      "Helvetica-Bold",
    fontSize:        7,
    paddingHorizontal: 4,
    paddingVertical:   2,
    borderRadius:      3,
    textAlign:         "center",
  },
  badgePendiente: {
    backgroundColor: C.amberBg,
    color:           C.amber,
    fontFamily:      "Helvetica-Bold",
    fontSize:        7,
    paddingHorizontal: 4,
    paddingVertical:   2,
    borderRadius:      3,
    textAlign:         "center",
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position:       "absolute",
    bottom:         22,
    left:           36,
    right:          36,
    flexDirection:  "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop:     5,
  },
  footerText: {
    fontSize: 7,
    color:    C.gray3,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResumenMetricasPdf({
  metrics,
  mes,
  anio,
  generatedAt,
  departamentoNombre,
}: ResumenMetricasProps) {
  const periodLabel = `${MONTH_NAMES[mes - 1]} ${anio}`;
  const rows: DeptoResumen[] = metrics.resumenPorDepto;

  const totalConfirmados  = rows.reduce((s, r) => s + r.asientosConfirmados, 0);
  const totalPendientes   = rows.reduce((s, r) => s + r.asientosPendientes,  0);
  const totalLiq          = rows.reduce((s, r) => s + r.totalAsientosLiq,    0);
  const totalViajesLiq    = rows.reduce((s, r) => s + r.viajesLiquidados,    0);

  const subtitle = departamentoNombre
    ? `Departamento: ${departamentoNombre}`
    : "Todos los departamentos";

  return (
    <Document
      title={`Resumen Liquidación — ${periodLabel}`}
      author="HarborFlow"
      subject="Resumen de liquidación por departamento"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerSystem}>HarborFlow</Text>
            <Text style={s.headerTitle}>RESUMEN DE LIQUIDACIÓN</Text>
            <Text style={s.headerSystem}>{subtitle}</Text>
          </View>
          <Text style={s.headerPeriod}>{periodLabel}</Text>
        </View>

        {/* ── KPI cards ───────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Resumen del período</Text>
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Total de viajes</Text>
            <Text style={s.kpiValue}>{metrics.totalViajesDelPeriodo}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Ocupación promedio</Text>
            <Text style={s.kpiValue}>{pct(metrics.promedioOcupacion)}</Text>
          </View>
          <View style={[s.kpiCard, s.kpiCardLast]}>
            <Text style={s.kpiLabel}>Sin liquidar</Text>
            <Text style={metrics.viajesSinLiquidar > 0 ? s.kpiValueAmber : s.kpiValue}>
              {metrics.viajesSinLiquidar}
            </Text>
          </View>
        </View>

        {/* ── Liquidation table ───────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: 18 }]}>
          Liquidación por departamento
        </Text>

        {/* Column headers */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.colDept]}>Departamento</Text>
          <Text style={[s.tableHeaderCell, s.colConfirm]}>Confirm.</Text>
          <Text style={[s.tableHeaderCell, s.colPending]}>Pend.</Text>
          <Text style={[s.tableHeaderCell, s.colTotal]}>Liq.</Text>
          <Text style={[s.tableHeaderCell, s.colViajes]}>Viajes</Text>
          <Text style={[s.tableHeaderCell, s.colStatus]}>Estado</Text>
        </View>

        {rows.length === 0 ? (
          <View style={[s.tableRow]}>
            <Text style={[s.tableCell, { color: C.gray4 }]}>
              Sin datos de liquidación para el período.
            </Text>
          </View>
        ) : (
          rows.map((row, idx) => (
            <View key={row.departamentoId} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tableCell, s.colDept]}>{row.departamentoNombre}</Text>
              <Text style={[s.tableCell, s.colConfirm]}>{row.asientosConfirmados}</Text>
              <Text style={[s.tableCell, s.colPending]}>{row.asientosPendientes}</Text>
              <Text style={[s.tableCell, s.colTotal]}>{row.totalAsientosLiq.toFixed(2)}</Text>
              <Text style={[s.tableCell, s.colViajes]}>{row.viajesLiquidados}</Text>
              <View style={s.colStatus}>
                <Text style={row.liquidado ? s.badgeLiquidado : s.badgePendiente}>
                  {row.liquidado ? "Liquidado" : "Pendiente"}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Totals row */}
        {rows.length > 0 && (
          <View style={s.tableRowTotals}>
            <Text style={[s.tableCellBold, s.colDept]}>TOTAL</Text>
            <Text style={[s.tableCellBold, s.colConfirm]}>{totalConfirmados}</Text>
            <Text style={[s.tableCellBold, s.colPending]}>{totalPendientes}</Text>
            <Text style={[s.tableCellBold, s.colTotal]}>{totalLiq.toFixed(2)}</Text>
            <Text style={[s.tableCellBold, s.colViajes]}>{totalViajesLiq}</Text>
            <Text style={[s.tableCell, s.colStatus]} />
          </View>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generado: {fmtDateTime(generatedAt)}</Text>
          <Text style={s.footerText}>HarborFlow — Resumen de liquidación</Text>
        </View>

      </Page>
    </Document>
  );
}
