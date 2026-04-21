// GET /api/viajes/[id]/pdf
//
// Generates and returns the "Ficha de Viaje" PDF for a completed trip.
//
// Auth: UABL or PROVEEDOR roles only.
// Eligibility: trip must have viajeStatus = PASADO (DEPARTED or COMPLETED).
//
// Response:
//   200  application/pdf — attachment with descriptive filename
//   400  VALIDATION_ERROR — trip not yet completed
//   401  UNAUTHORIZED
//   403  FORBIDDEN
//   404  NOT_FOUND
//   500  INTERNAL_ERROR

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer }            from "@react-pdf/renderer";
import type { DocumentProps }        from "@react-pdf/renderer";
import React                         from "react";

import { auth }        from "@/lib/auth";
import { prisma }      from "@/lib/prisma";
import { AppError }    from "@/lib/errors";
import { assertRole }  from "@/lib/permissions";

import { FichaViajePdf } from "@/components/pdf/FichaViaje";
import type { SlotEntry, LiqEntry, TripData } from "@/components/pdf/FichaViaje";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL", "PROVEEDOR"]);

    const { id: tripId } = await params;
    const { companyId }  = session.user;

    // ── 1. Fetch trip ────────────────────────────────────────────────────────
    const trip = await prisma.trip.findUnique({
      where:  { id: tripId, companyId },
      select: {
        id:                   true,
        departureTime:        true,
        capacity:             true,
        status:               true,
        viajeStatus:          true,
        boat:                 { select: { name: true } },
        driver:               { select: { firstName: true, lastName: true } },
        branch:               { select: { name: true } },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
        { status: 404 },
      );
    }

    // Only generate fichas for completed trips.
    if (trip.viajeStatus !== "PASADO") {
      return NextResponse.json(
        {
          error: {
            code:    "VALIDATION_ERROR",
            message: "La ficha solo está disponible para viajes completados.",
          },
        },
        { status: 400 },
      );
    }

    // ── 2. Fetch slots with department names ─────────────────────────────────
    const rawSlots = await prisma.passengerSlot.findMany({
      where:   { companyId, tripId },
      include: {
        usuario:    { select: { firstName: true, lastName: true } },
        workType:   { select: { name: true, code: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const slots: SlotEntry[] = rawSlots.map((s) => ({
      id:                 s.id,
      status:             s.status,
      departmentId:       s.departmentId,
      departmentName:     s.department.name,
      usuarioFirstName:   s.usuario.firstName,
      usuarioLastName:    s.usuario.lastName,
      workTypeName:       s.workType.name,
      workTypeCode:       s.workType.code,
      representedCompany: s.representedCompany,
    }));

    // ── 3. Fetch liquidation records (optional) ──────────────────────────────
    const liqRecords = await prisma.asientoLiquidacion.findMany({
      where:   { companyId, viajeId: tripId },
      select: {
        departamentoId:     true,
        departamento:       { select: { name: true } },
        totalAsientos:      true,
        asientosReservados: true,
      },
    });

    const liquidacion: LiqEntry[] = liqRecords.map((l) => ({
      departamentoId:     l.departamentoId,
      departamentoNombre: l.departamento.name,
      totalAsientos:      Number(l.totalAsientos),
      asientosReservados: l.asientosReservados,
    }));

    // ── 4. Build trip data object ────────────────────────────────────────────
    const tripData: TripData = {
      id:            trip.id,
      departureTime: trip.departureTime,
      capacity:      trip.capacity,
      status:        trip.status,
      boat:          trip.boat,
      driver:        trip.driver,
      branch:        trip.branch,
    };

    // ── 5. Render PDF ────────────────────────────────────────────────────────
    const generatedAt = new Date();

    const buffer = await renderToBuffer(
      React.createElement(FichaViajePdf, {
        trip:        tripData,
        slots,
        liquidacion: liquidacion.length > 0 ? liquidacion : undefined,
        generatedAt,
      }) as React.ReactElement<DocumentProps>,
    );

    // ── 6. Build filename ─────────────────────────────────────────────────────
    const depDate = trip.departureTime
      .toISOString()
      .slice(0, 10)                 // YYYY-MM-DD
      .replace(/-/g, "-");
    const boatSlug = trip.boat.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 24);
    const filename = `ficha-viaje-${boatSlug}-${depDate}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/viajes/[id]/pdf]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error al generar el PDF." } },
      { status: 500 },
    );
  }
}
