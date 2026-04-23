// PATCH /api/conductor/perfil — update firstName and lastName for the current conductor user.
//
// Auth: CONDUCTOR role only. User is always identified from session (never from body).
// Body: { firstName: string; lastName: string }
// Response: { data: { firstName: string; lastName: string } }

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { auth }                      from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";

const PatchSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido.").max(80),
  lastName:  z.string().min(1, "El apellido es requerido.").max(80),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autenticado." } },
      { status: 401 },
    );
  }
  if (session.user.role !== "CONDUCTOR") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Acceso denegado." } },
      { status: 403 },
    );
  }

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
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos.";
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: msg } },
      { status: 400 },
    );
  }

  const { firstName, lastName } = parsed.data;

  const updated = await prisma.user.update({
    where:  { id: session.user.id },
    data:   { firstName, lastName },
    select: { firstName: true, lastName: true },
  });

  return NextResponse.json({ data: updated });
}
