// POST /api/allocations — Create a new DRAFT allocation (COMPANY_REP only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { CreateAllocationSchema } from "@/modules/allocations/schema";
import { createAllocation } from "@/modules/allocations/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["COMPANY_REP"]);

    const body = await request.json();
    const parsed = CreateAllocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const allocation = await createAllocation({
      tripId: parsed.data.tripId,
      companyId: session.user.companyId,
      requestedById: session.user.id,
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
}
