// =============================================================================
// GET  /api/admin/company  — returns emailAdministrador for the current company
// PATCH /api/admin/company  — updates emailAdministrador
//
// Auth: UABL role + isUablAdmin = true
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { auth }                      from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAction }                 from "@/modules/audit/repository";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }
  if (session.user.role !== "UABL" || !session.user.isUablAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

  const company = await prisma.company.findUnique({
    where:  { id: session.user.companyId },
    select: { emailAdministrador: true },
  });

  return NextResponse.json({ emailAdministrador: company?.emailAdministrador ?? null });
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

const PatchSchema = z.object({
  emailAdministrador: z.string().email().nullable(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }
  if (session.user.role !== "UABL" || !session.user.isUablAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

  const body   = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Email inválido.", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const updated = await prisma.company.update({
    where:  { id: session.user.companyId },
    data:   { emailAdministrador: parsed.data.emailAdministrador },
    select: { emailAdministrador: true },
  });

  await logAction({
    companyId:  session.user.companyId,
    actorId:    session.user.id,
    action:     "COMPANY_CONFIG_UPDATED",
    entityType: "Company",
    entityId:   session.user.companyId,
    payload:    { emailAdministrador: parsed.data.emailAdministrador },
  });

  return NextResponse.json({ emailAdministrador: updated.emailAdministrador });
}
