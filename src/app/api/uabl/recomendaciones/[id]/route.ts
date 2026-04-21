// =============================================================================
// PATCH /api/uabl/recomendaciones/[id]
// =============================================================================
//
// Updates the estado of a RecomendacionIA record.
//
// Body: { estado: "IMPLEMENTADA" | "DESCARTADA" }
// Response: { recomendacion: RecomendacionIA }
// Auth: UABL role only. companyId enforced at query level.
//
// Only ACTIVA recommendations can be transitioned.
// IMPLEMENTADA and DESCARTADA are terminal states.
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const PatchSchema = z.object({
  estado: z.enum(["IMPLEMENTADA", "DESCARTADA"]),
});

// ---------------------------------------------------------------------------
// PATCH handler
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Autenticación requerida." } },
      { status: 401 },
    );
  }
  if (session.user.role !== "UABL") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Solo usuarios UABL." } },
      { status: 403 },
    );
  }

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "JSON inválido." } },
      { status: 400 },
    );
  }

  const parsed = PatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code:    "VALIDATION_ERROR",
          message: "estado debe ser IMPLEMENTADA o DESCARTADA.",
        },
      },
      { status: 400 },
    );
  }

  // companyId enforced in the where clause — a UABL user from company A
  // cannot update a recommendation that belongs to company B.
  const existing = await prisma.recomendacionIA.findUnique({
    where: { id },
  });

  if (!existing || existing.companyId !== session.user.companyId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Recomendación no encontrada." } },
      { status: 404 },
    );
  }

  if (existing.estado !== "ACTIVA") {
    return NextResponse.json(
      {
        error: {
          code:    "VALIDATION_ERROR",
          message: "Solo se puede actualizar el estado de recomendaciones ACTIVAS.",
        },
      },
      { status: 422 },
    );
  }

  const updated = await prisma.recomendacionIA.update({
    where: { id },
    data:  { estado: parsed.data.estado },
  });

  return NextResponse.json({ recomendacion: updated });
}
