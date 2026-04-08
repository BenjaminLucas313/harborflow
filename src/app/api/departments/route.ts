// GET  /api/departments — list active departments (authenticated)
// POST /api/departments — create a department (UABL admin only)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole, assertUablAdmin } from "@/lib/permissions";
import {
  listDepartments,
  createDepartment,
} from "@/modules/departments/service";
import { CreateDepartmentSchema } from "@/modules/departments/schema";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const depts = await listDepartments(session.user.companyId);
    return NextResponse.json(depts);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["UABL"]);
    assertUablAdmin(session.user.isUablAdmin);

    const body = await req.json();
    const parsed = CreateDepartmentSchema.safeParse({
      ...body,
      companyId: session.user.companyId,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const dept = await createDepartment(parsed.data, session.user.id);
    return NextResponse.json(dept, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
