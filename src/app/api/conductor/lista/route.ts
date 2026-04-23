// GET /api/conductor/lista
// Returns all active drivers for the authenticated PROVEEDOR's company.
// Used by the conductor-selector in the trip detail view.

import { NextResponse } from "next/server";
import { auth }         from "@/lib/auth";
import { prisma }       from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }
  if (session.user.role !== "PROVEEDOR") {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

  const drivers = await prisma.driver.findMany({
    where:   { companyId: session.user.companyId, isActive: true },
    select:  {
      id:            true,
      firstName:     true,
      lastName:      true,
      licenseNumber: true,
      phone:         true,
      userId:        true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const shaped = drivers.map((d) => ({
    id:            d.id,
    firstName:     d.firstName,
    lastName:      d.lastName,
    licenseNumber: d.licenseNumber,
    phone:         d.phone,
    hasUser:       d.userId !== null,
  }));

  return NextResponse.json({ data: { drivers: shaped }, error: null });
}
