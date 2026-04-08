// POST /api/seat-requests/[seatRequestId]/reject — UABL rejects a seat (UABL_STAFF only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { rejectSeatRequest } from "@/modules/allocations/service";
import { z } from "zod";
import { NextResponse } from "next/server";

const RejectBody = z.object({
  rejectionNote: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ seatRequestId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["UABL_STAFF"]);

    if (!session.user.departmentId) {
      return NextResponse.json(
        { error: "Your account is not assigned to a department." },
        { status: 403 },
      );
    }

    const { seatRequestId } = await params;
    const body = await request.json();
    const parsed = RejectBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const seat = await rejectSeatRequest({
      seatRequestId,
      uablStaffId: session.user.id,
      uablDepartmentId: session.user.departmentId,
      uablCompanyId: session.user.companyId,
      rejectionNote: parsed.data.rejectionNote,
    });

    return NextResponse.json(seat);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
}
