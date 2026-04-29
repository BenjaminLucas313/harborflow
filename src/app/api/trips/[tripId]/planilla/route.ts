// GET /api/trips/[tripId]/planilla
//
// Generates and returns the passenger roster PDF for a trip.
// Available for any trip status — intended for use before departure.
//
// Auth:
//   UABL     — allowed by role
//   PROVEEDOR — allowed by role
//   CONDUCTOR — allowed only if assigned as driver for this trip
//
// Response:
//   200  application/pdf — attachment with descriptive filename
//   401  UNAUTHORIZED
//   403  FORBIDDEN
//   404  NOT_FOUND
//   500  INTERNAL_ERROR

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer }            from "@react-pdf/renderer";
import type { DocumentProps }        from "@react-pdf/renderer";
import React                         from "react";

import { auth }       from "@/lib/auth";
import { prisma }     from "@/lib/prisma";
import { assertRole } from "@/lib/permissions";
import { AppError }   from "@/lib/errors";

import { PlanillaPasajerosPdf } from "@/components/pdf/PlanillaPasajerosPdf";
import type { ConfirmedSlot, PlanillaData } from "@/components/pdf/PlanillaPasajerosPdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autenticado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL", "PROVEEDOR", "CONDUCTOR"]);

    const { tripId }    = await params;
    const { companyId } = session.user;

    // ── 1. Fetch trip ────────────────────────────────────────────────────────
    const trip = await prisma.trip.findFirst({
      where:  { id: tripId, companyId },
      select: {
        id:                   true,
        departureTime:        true,
        estimatedArrivalTime: true,
        capacity:             true,
        driverId:             true,
        boat:   { select: { name: true } },
        driver: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
        stops:  {
          select:  { order: true, name: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Viaje no encontrado." } },
        { status: 404 },
      );
    }

    // ── 2. Additional guard for CONDUCTOR role ───────────────────────────────
    // A conductor may only download the planilla for the trip they are assigned to.
    if (session.user.role === "CONDUCTOR") {
      const driver = await prisma.driver.findFirst({
        where:  { userId: session.user.id, isActive: true, companyId },
        select: { id: true },
      });
      if (!driver || trip.driverId !== driver.id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "No estás asignado a este viaje." } },
          { status: 403 },
        );
      }
    }

    // ── 3. Fetch confirmed passengers ────────────────────────────────────────
    const rawSlots = await prisma.passengerSlot.findMany({
      where:   { tripId, companyId, status: "CONFIRMED" },
      select: {
        id:         true,
        usuario:    { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
      orderBy: [
        { department: { name: "asc" } },
        { usuario:    { lastName: "asc" } },
      ],
    });

    const slots: ConfirmedSlot[] = rawSlots.map((s) => ({
      id:               s.id,
      usuarioFirstName: s.usuario.firstName,
      usuarioLastName:  s.usuario.lastName,
      departmentName:   s.department?.name ?? "Sin departamento",
    }));

    // ── 4. Build data object ─────────────────────────────────────────────────
    const planillaData: PlanillaData = {
      departureTime:        trip.departureTime,
      estimatedArrivalTime: trip.estimatedArrivalTime,
      capacity:             trip.capacity,
      boat:                 trip.boat,
      driver:               trip.driver,
      branch:               trip.branch,
      stops:                trip.stops,
    };

    // ── 5. Render PDF ────────────────────────────────────────────────────────
    const generatedAt = new Date();
    const buffer = await renderToBuffer(
      React.createElement(PlanillaPasajerosPdf, {
        trip:        planillaData,
        slots,
        generatedAt,
      }) as React.ReactElement<DocumentProps>,
    );

    // ── 6. Build filename ────────────────────────────────────────────────────
    const depDate  = trip.departureTime.toISOString().slice(0, 10);
    const boatSlug = trip.boat.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 24);
    const filename = `planilla-${boatSlug}-${depDate}.pdf`;

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
    console.error("[GET /api/trips/[tripId]/planilla]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error al generar la planilla." } },
      { status: 500 },
    );
  }
}
