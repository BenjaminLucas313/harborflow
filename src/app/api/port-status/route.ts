// POST /api/port-status — create a new port status record (PROVEEDOR only)
//
// Body: { branchId, status, message? }
// Status values: OPEN | PARTIALLY_OPEN | CLOSED_WEATHER | CLOSED_MAINTENANCE | CLOSED_SECURITY | CLOSED_OTHER

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PortStatusValue } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/modules/audit/repository";

const BodySchema = z.object({
  branchId: z.string().min(1),
  status:   z.enum(Object.values(PortStatusValue) as [string, ...string[]]),
  message:  z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (session.user.role !== "PROVEEDOR") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const { branchId, status, message } = parsed.data;
  const { companyId, id: userId } = session.user;

  // Verify the branch belongs to this company.
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId, isActive: true },
    select: { id: true },
  });
  if (!branch) {
    return NextResponse.json({ error: "Puerto no encontrado." }, { status: 404 });
  }

  // Non-OPEN statuses require a message.
  if (status !== "OPEN" && !message?.trim()) {
    return NextResponse.json(
      { error: "El motivo es obligatorio para estados no disponibles." },
      { status: 400 },
    );
  }

  const portStatus = await prisma.portStatus.create({
    data: {
      companyId,
      branchId,
      status:     status as PortStatusValue,
      message:    message?.trim() || null,
      setByUserId: userId,
    },
    select: {
      id:        true,
      status:    true,
      message:   true,
      createdAt: true,
    },
  });

  logAction({
    companyId,
    actorId:    userId,
    action:     "PORT_STATUS_CHANGED",
    entityType: "PortStatus",
    entityId:   portStatus.id,
    payload:    { branchId, status, message },
  }).catch(() => {});

  return NextResponse.json({ portStatus }, { status: 201 });
}
