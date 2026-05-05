// =============================================================================
// GET  /api/employers — list all employers for the company (UABL only)
// POST /api/employers — create a new employer
//
// Auth:
//   GET  → UABL only
//   POST → UABL or EMPRESA
//         When caller is EMPRESA: the new employer is automatically linked to
//         the caller's user account (employerId), enabling the onboarding wizard.
//
// GET response:
//   200 { data: EmployerRow[] }
//
// POST body:
//   { name, representante?, telefono? }
//
// POST response:
//   201 { data: { id, name, representante, telefono } }
//   400 VALIDATION_ERROR
//   401/403
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { auth }                      from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { AppError }                  from "@/lib/errors";
import { assertRole }                from "@/lib/permissions";
import { logAction }                 from "@/modules/audit/repository";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateEmployerSchema = z.object({
  name:          z.string().min(1).max(200).trim(),
  representante: z.string().max(200).trim().optional(),
  telefono:      z.string().max(50).trim().optional(),
});

// ---------------------------------------------------------------------------
// GET — list employers with user count
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

    const employers = await prisma.employer.findMany({
      where:   { companyId: session.user.companyId, isActive: true },
      select: {
        id:            true,
        name:          true,
        representante: true,
        telefono:      true,
        createdAt:     true,
        _count:        { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });

    const data = employers.map(({ _count, ...e }) => ({
      ...e,
      userCount: _count.users,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[GET /api/employers]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create employer (+ auto-link if caller is EMPRESA)
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

    assertRole(session.user.role, ["UABL", "EMPRESA"]);

    const rawBody = await req.json().catch(() => null);
    const parsed = CreateEmployerSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: firstIssue?.message ?? "Datos inválidos." } },
        { status: 400 },
      );
    }

    const { name, representante, telefono } = parsed.data;
    const { companyId } = session.user;
    const isEmpresa = session.user.role === "EMPRESA";

    // Create employer + optionally link to caller user in a single transaction.
    const employer = await prisma.$transaction(async (tx) => {
      const created = await tx.employer.create({
        data: { companyId, name, representante, telefono },
        select: { id: true, name: true, representante: true, telefono: true },
      });

      if (isEmpresa) {
        await tx.user.update({
          where: { id: session.user.id },
          data:  { employerId: created.id },
        });
      }

      return created;
    });

    logAction({
      companyId,
      actorId:    session.user.id,
      action:     "EMPLOYER_CREATED",
      entityType: "Employer",
      entityId:   employer.id,
      payload:    { name, representante, telefono, selfLinked: isEmpresa },
    }).catch(() => {});

    return NextResponse.json({ data: employer }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/employers]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
