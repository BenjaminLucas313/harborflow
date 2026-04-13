// POST /api/slots/[slotId]/revert — UABL reverts a CONFIRMED slot back to CANCELLED.
//
// Authorization:
//   - The UABL user who originally confirmed the slot, OR
//   - Any UABL user with isUablAdmin = true within the same company.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertRole } from "@/lib/permissions";
import { revertSlot } from "@/modules/passenger-slots/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL"]);

    const { slotId } = await params;
    const slot = await revertSlot(slotId, {
      companyId:   session.user.companyId,
      actorId:     session.user.id,
      isUablAdmin: session.user.isUablAdmin,
    });

    return NextResponse.json(slot);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/slots/[slotId]/revert]", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}
