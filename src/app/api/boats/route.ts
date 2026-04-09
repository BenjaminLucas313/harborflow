// POST /api/boats — create a boat (PROVEEDOR only)
// companyId is always derived from the session — never trusted from the client.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createBoat } from "@/modules/boats/service";

const CreateBoatBodySchema = z.object({
  branchId:    z.string().min(1),
  name:        z.string().min(1),
  capacity:    z.number().int().positive(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 },
    );
  }
  if (session.user.role !== "PROVEEDOR") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Solo PROVEEDOR puede crear embarcaciones." },
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

  const parsed = CreateBoatBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Datos inválidos." },
      { status: 400 },
    );
  }

  try {
    const boat = await createBoat(parsed.data, { companyId: session.user.companyId });
    return NextResponse.json({ boat }, { status: 201 });
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
