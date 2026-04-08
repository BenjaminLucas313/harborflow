// POST /api/allocations/[allocationId]/seats — Add a seat request (COMPANY_REP only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { AddSeatRequestSchema } from "@/modules/allocations/schema";
import { addSeatRequest } from "@/modules/allocations/service";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ allocationId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["COMPANY_REP"]);

    const { allocationId } = await params;
    const body = await request.json();
    const parsed = AddSeatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const seat = await addSeatRequest({
      allocationId,
      employeeId: parsed.data.employeeId,
      workTypeId: parsed.data.workTypeId,
      companyId: session.user.companyId,
      requestedById: session.user.id,
    });

    return NextResponse.json(seat, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
}
