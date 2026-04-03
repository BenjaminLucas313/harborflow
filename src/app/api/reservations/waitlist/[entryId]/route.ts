// DELETE /api/reservations/waitlist/[entryId]
// Removes the authenticated passenger from a waitlist.
// Remaining WAITING positions are repacked to maintain a contiguous FIFO queue.
//
// Note: the literal "waitlist" segment takes router priority over the dynamic
// [reservationId] segment, so this route never conflicts with reservation cancellation.

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { cancelWaitlistEntry } from "@/modules/reservations/service";

type RouteParams = { params: Promise<{ entryId: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  if (session.user.role !== "PASSENGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Only passengers can leave a waitlist." },
      { status: 403 },
    );
  }

  const { entryId } = await params;

  try {
    const result = await cancelWaitlistEntry({
      entryId,
      userId: session.user.id,
      companyId: session.user.companyId,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
