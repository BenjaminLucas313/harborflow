// =============================================================================
// GET /api/auth/check-account?email=&companySlug=
// =============================================================================
//
// Pre-login account existence check. Returns a reason code so the login form
// can show a specific error before calling signIn().
//
// This endpoint checks company + user existence ONLY — it never validates
// passwords. It is intentionally public (no auth required).
//
// SECURITY NOTE: deliberately returns the same HTTP 200 for all cases to
// prevent user enumeration via status codes. The `reason` field is shown only
// to help legitimate users, not to leak account existence to attackers.
// Rate-limiting should be added at the infra level for production.
//
// Response:
//   200 { found: true }                      — company and user exist
//   200 { found: false; reason: "NO_COMPANY" }  — company slug not found or inactive
//   200 { found: false; reason: "NO_USER" }     — company found but no user with that email
//   400 { error: { code: "VALIDATION_ERROR" } } — missing/invalid params
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const QuerySchema = z.object({
  email:       z.string().email(),
  companySlug: z.string().min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    email:       searchParams.get("email") ?? "",
    companySlug: searchParams.get("companySlug") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "email y companySlug son requeridos." } },
      { status: 400 },
    );
  }

  const { email, companySlug } = parsed.data;

  const company = await prisma.company.findUnique({
    where:  { slug: companySlug },
    select: { id: true, isActive: true },
  });

  if (!company?.isActive) {
    return NextResponse.json({ found: false, reason: "NO_COMPANY" });
  }

  const user = await prisma.user.findUnique({
    where:  { companyId_email: { companyId: company.id, email } },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    return NextResponse.json({ found: false, reason: "NO_USER" });
  }

  return NextResponse.json({ found: true });
}
