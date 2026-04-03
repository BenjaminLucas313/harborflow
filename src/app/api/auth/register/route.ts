// POST /api/auth/register — public passenger self-registration.
// Delegates to modules/auth/service.registerPassenger; maps AppError codes to HTTP responses.
import { NextRequest, NextResponse } from "next/server";

import { RegisterSchema } from "@/modules/auth/schema";
import { registerPassenger } from "@/modules/auth/service";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid request data." },
      { status: 400 },
    );
  }

  try {
    await registerPassenger(parsed.data);
    return NextResponse.json({ success: true }, { status: 201 });
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
