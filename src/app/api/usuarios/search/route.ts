// GET /api/usuarios/search?q=<query> — live-search USUARIO accounts by name (EMPRESA only)
// Returns id + name only. Email intentionally excluded for privacy.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { searchUsuarios } from "@/modules/users/service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["EMPRESA"]);

    const q = new URL(req.url).searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json([]);

    const results = await searchUsuarios(session.user.companyId, q);
    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
