// =============================================================================
// POST /api/auth/reset-password
//
// Consumes a password reset token and sets the new password.
//
// Body: { token: string, newPassword: string }
//
// Responses:
//   200 { ok: true }         — password changed successfully
//   400 INVALID_TOKEN        — token not found, expired, or already used
//   422 VALIDATION_ERROR     — body fails schema validation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import bcrypt                        from "bcryptjs";
import { prisma }                    from "@/lib/prisma";

const Schema = z.object({
  token:       z.string().min(1),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos.";
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: msg } },
      { status: 422 },
    );
  }

  const { token, newPassword } = parsed.data;

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where:  { token },
      select: { id: true, userId: true, expiresAt: true, used: true },
    });

    const isValid =
      record &&
      !record.used &&
      record.expiresAt > new Date();

    if (!isValid) {
      return NextResponse.json(
        { error: { code: "INVALID_TOKEN", message: "El link es inválido o ya expiró." } },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data:  { passwordHash, mustChangePassword: false },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data:  { used: true },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
