// GET  /api/work-types           — list all active work types (authenticated)
// POST /api/work-types           — create a work type (UABL admin only)
// PATCH /api/work-types/[id]     — is handled by the [id] subroute

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole, assertUablAdmin } from "@/lib/permissions";
import {
  listWorkTypes,
  createWorkType,
} from "@/modules/work-types/service";
import { CreateWorkTypeSchema } from "@/modules/work-types/schema";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const departmentId = new URL(req.url).searchParams.get("departmentId") ?? undefined;
    const wts = await listWorkTypes(session.user.companyId, departmentId);
    return NextResponse.json(wts);
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
    const parsed = CreateWorkTypeSchema.safeParse({
      ...body,
      companyId: session.user.companyId,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const wt = await createWorkType(parsed.data, session.user.id);
    return NextResponse.json(wt, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
