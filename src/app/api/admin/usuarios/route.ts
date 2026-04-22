// =============================================================================
// GET  /api/admin/usuarios — list users for the company
// POST /api/admin/usuarios — create a new user
// =============================================================================
//
// Auth: isUablAdmin only.
//
// GET response:
//   200 { data: UserRow[] }
//
// POST body:
//   { email, password, firstName, lastName, role, branchId?, departmentId?, isUablAdmin? }
//
// POST response:
//   201 { data: { id, email } }
//   400 VALIDATION_ERROR
//   409 EMAIL_CONFLICT
//   401/403
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt                        from "bcryptjs";
import { randomBytes }               from "crypto";
import { z }                         from "zod";
import { auth }                      from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { AppError }                  from "@/lib/errors";
import { assertRole }                from "@/lib/permissions";
import { logAction }                 from "@/modules/audit/repository";
import { sendBienvenida }            from "@/services/email.service";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateUserSchema = z.object({
  email:        z.string().email(),
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  role:         z.enum(["UABL", "PROVEEDOR", "EMPRESA", "USUARIO"]),
  branchId:     z.string().optional(),
  departmentId: z.string().optional(),
  isUablAdmin:  z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
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
        { error: { code: "FORBIDDEN", message: "Solo administradores UABL pueden gestionar usuarios." } },
        { status: 403 },
      );
    }

    const users = await prisma.user.findMany({
      where:   { companyId: session.user.companyId },
      select: {
        id:          true,
        email:       true,
        firstName:   true,
        lastName:    true,
        role:        true,
        isActive:    true,
        isUablAdmin: true,
        createdAt:   true,
        branch:      { select: { name: true } },
        department:  { select: { name: true } },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/admin/usuarios]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
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
        { error: { code: "FORBIDDEN", message: "Solo administradores UABL pueden crear usuarios." } },
        { status: 403 },
      );
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = CreateUserSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: firstIssue?.message ?? "Datos inválidos." } },
        { status: 400 },
      );
    }

    const { email, firstName, lastName, role, branchId, departmentId, isUablAdmin } = parsed.data;
    const { companyId } = session.user;

    // Find any existing user with this email (active or soft-deleted).
    const existing = await prisma.user.findFirst({
      where:  { companyId, email },
      select: { id: true, isActive: true },
    });

    // Active user with same email → genuine conflict.
    if (existing?.isActive) {
      return NextResponse.json(
        { error: { code: "EMAIL_CONFLICT", message: "Ya existe un usuario activo con ese correo en esta organización." } },
        { status: 409 },
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Soft-deleted user → reactivate in place, preserving the original id and audit history.
    if (existing && !existing.isActive) {
      await prisma.user.updateMany({
        where: { id: existing.id, companyId },
        data: {
          firstName,
          lastName,
          role,
          passwordHash,
          branchId:           branchId     || null,
          departmentId:       departmentId || null,
          isUablAdmin:        isUablAdmin  ?? false,
          mustChangePassword: true,
          isActive:           true,
        },
      });

      await logAction({
        companyId,
        actorId:    session.user.id,
        action:     "USER_CREATED",
        entityType: "User",
        entityId:   existing.id,
        payload:    { email, role, reactivated: true },
      });

      sendBienvenida({ nombre: firstName, email, password: tempPassword, rol: role })
        .catch((err) => console.error("[POST /api/admin/usuarios] sendBienvenida reactivation error:", err));

      return NextResponse.json({ data: { id: existing.id, email } }, { status: 201 });
    }

    // No existing user → create fresh.
    const user = await prisma.user.create({
      data: {
        companyId,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        branchId:           branchId     || null,
        departmentId:       departmentId || null,
        isUablAdmin:        isUablAdmin  ?? false,
        mustChangePassword: true,
      },
      select: { id: true, email: true, role: true, firstName: true },
    });

    await logAction({
      companyId,
      actorId:    session.user.id,
      action:     "USER_CREATED",
      entityType: "User",
      entityId:   user.id,
      payload:    { email: user.email, role: user.role },
    });

    console.log("[POST /api/admin/usuarios] triggering sendBienvenida for:", user.email);
    sendBienvenida({
      nombre:   user.firstName,
      email:    user.email,
      password: tempPassword,
      rol:      user.role,
    }).catch((err) =>
      console.error("[POST /api/admin/usuarios] sendBienvenida uncaught rejection:", err),
    );

    return NextResponse.json({ data: { id: user.id, email: user.email } }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/admin/usuarios]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
