// POST /api/allocations/[allocationId]/submit — Submit allocation to UABL (COMPANY_REP only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { submitAllocation } from "@/modules/allocations/service";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ allocationId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["COMPANY_REP"]);

    const { allocationId } = await params;

    const allocation = await submitAllocation({
      allocationId,
      companyId: session.user.companyId,
      requestedById: session.user.id,
    });

    return NextResponse.json(allocation);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
}
