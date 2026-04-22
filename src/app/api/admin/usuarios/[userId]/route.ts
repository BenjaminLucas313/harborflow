// =============================================================================
// DELETE /api/admin/usuarios/[userId]
// =============================================================================
//
// Auth: UABL + isUablAdmin only.
//
// Business rules enforced:
//   - Actor cannot delete themselves.
//   - Target must belong to the same company (tenant isolation).
//   - AuditLog is written FIRST inside the transaction — if it fails, the
//     user is NOT deactivated and Postgres rolls back the entire operation.
//   - Future PENDING/CONFIRMED PassengerSlots are cancelled in the same tx.
//   - Soft-delete (isActive = false) preserves FK integrity for historical data.
//
// Response:
//   200 { data: { id } }
//   400 SELF_DELETE
//   401 UNAUTHORIZED
//   403 FORBIDDEN
//   404 NOT_FOUND
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma }      from "@prisma/client";
import { auth }        from "@/lib/auth";
import { prisma }      from "@/lib/prisma";
import { AppError }    from "@/lib/errors";
import { assertRole }  from "@/lib/permissions";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL"]);

    if (!session.user.isUablAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Solo administradores UABL pueden eliminar usuarios." } },
        { status: 403 },
      );
    }

    const { userId } = params;

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: { code: "SELF_DELETE", message: "No podés eliminarte a vos mismo." } },
        { status: 400 },
      );
    }

    const target = await prisma.user.findFirst({
      where:  { id: userId },
      select: { id: true, companyId: true, email: true, role: true, isActive: true },
    });

    if (!target || target.companyId !== session.user.companyId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Usuario no encontrado." } },
        { status: 404 },
      );
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Write audit log first — if this fails, nothing else runs and
      //    Postgres rolls back, leaving the user active.
      await tx.auditLog.create({
        data: {
          companyId:  session.user.companyId,
          actorId:    session.user.id,
          action:     "USER_DELETED",
          entityType: "User",
          entityId:   userId,
          payload:    { email: target.email, role: target.role } as Prisma.InputJsonValue,
        },
      });

      // 2. Soft-delete the user — companyId filter enforces tenant isolation.
      await tx.user.updateMany({
        where: { id: userId, companyId: session.user.companyId },
        data:  { isActive: false },
      });

      // 3. Cancel any future active slots assigned to this user.
      await tx.passengerSlot.updateMany({
        where: {
          usuarioId: userId,
          status:    { in: ["PENDING", "CONFIRMED"] },
          trip:      { departureTime: { gt: now } },
        },
        data: { status: "CANCELLED" },
      });
    });

    return NextResponse.json({ data: { id: userId } });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[DELETE /api/admin/usuarios/[userId]]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
