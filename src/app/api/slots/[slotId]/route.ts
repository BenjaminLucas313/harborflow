// PATCH /api/slots/[slotId] — confirm or reject a slot (UABL only)
// GET   /api/slots/[slotId] — get slot detail

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseZodError } from "@/lib/zod-errors";
import { assertRole } from "@/lib/permissions";
import { reviewSlot, getSlotById } from "@/modules/passenger-slots/service";
import { ReviewSlotSchema } from "@/modules/passenger-slots/schema";

export async function GET(
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

    assertRole(session.user.role, ["UABL", "EMPRESA"]);

    const { slotId } = await params;
    const slot = await getSlotById(slotId, session.user.companyId);
    return NextResponse.json(slot);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json();
    const parsed = ReviewSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Datos inválidos.", fields: parseZodError(parsed.error) },
        { status: 400 },
      );
    }

    const { slotId } = await params;
    const slot = await reviewSlot(slotId, parsed.data, {
      companyId:    session.user.companyId,
      reviewedById: session.user.id,
      departmentId: session.user.departmentId,
      isUablAdmin:  session.user.isUablAdmin,
    });

    return NextResponse.json(slot);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[PATCH /api/slots/[slotId]]", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Error interno." },
      { status: 500 },
    );
  }
}
