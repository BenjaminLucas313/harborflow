// DELETE /api/allocations/[allocationId]/seats/[seatId] — Remove a seat (COMPANY_REP only)
import { auth } from "@/lib/auth";
import { assertRole } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { removeSeatRequest } from "@/modules/allocations/service";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ allocationId: string; seatId: string }> },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    assertRole(session.user.role, ["COMPANY_REP"]);

    const { seatId } = await params;

    await removeSeatRequest({
      seatRequestId: seatId,
      companyId: session.user.companyId,
      requestedById: session.user.id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
}
