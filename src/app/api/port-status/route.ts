// POST /api/port-status — change port status (PROVIDER only)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { SetPortStatusSchema } from "@/modules/port-status/schema";
import { setPortStatus } from "@/modules/port-status/service";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }

  if (session.user.role !== "PROVIDER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Only the provider can change port status." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // companyId and setByUserId are always derived from the session.
  const parsed = SetPortStatusSchema.safeParse({
    ...(body as object),
    companyId: session.user.companyId,
    setByUserId: session.user.id,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid request data." },
      { status: 400 },
    );
  }

  try {
    const record = await setPortStatus(parsed.data);
    return NextResponse.json({ portStatus: record }, { status: 201 });
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
