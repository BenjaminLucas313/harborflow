// POST /api/seat-requests/[seatRequestId]/confirm — UABL confirms a seat (UABL_STAFF only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { confirmSeatRequest } from "@/modules/allocations/service";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ seatRequestId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["UABL_STAFF"]);

    if (!session.user.departmentId) {
      return NextResponse.json(
        { error: "Your account is not assigned to a department. Contact your administrator." },
        { status: 403 },
      );
    }

    const { seatRequestId } = await params;

    const seat = await confirmSeatRequest({
      seatRequestId,
      uablStaffId: session.user.id,
      uablDepartmentId: session.user.departmentId,
      uablCompanyId: session.user.companyId,
    });

    return NextResponse.json(seat);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
}
