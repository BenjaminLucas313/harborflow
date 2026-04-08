// GET /api/work-types — List active work types grouped by department (COMPANY_REP only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { listActiveDepartments } from "@/modules/departments/repository";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  assertRole(session.user.role, ["COMPANY_REP"]);

  const departments = await listActiveDepartments();
  return NextResponse.json(departments);
}
