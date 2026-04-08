// GET /api/employees/search?q= — Employee autocomplete (COMPANY_REP only)
// Returns matching employees within the caller's company.
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { searchEmployees } from "@/modules/employees/repository";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  assertRole(session.user.role, ["COMPANY_REP"]);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchEmployees(q, session.user.companyId, 10);
  return NextResponse.json(results);
}
