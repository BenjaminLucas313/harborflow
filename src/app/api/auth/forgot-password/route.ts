// =============================================================================
// POST /api/auth/forgot-password
//
// Initiates the password reset flow. Always responds 200 regardless of whether
// the email exists — this prevents user enumeration attacks.
//
// Body: { email: string }
//
// Flow:
//   1. Validate email shape.
//   2. Look up user by email (across all companies — email is the unique identifier here).
//   3. If user exists: generate a UUID token, store in PasswordResetToken (1h expiry),
//      and send the reset email via Brevo.
//   4. Respond 200 unconditionally.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { randomUUID }                from "crypto";
import { prisma }                    from "@/lib/prisma";
import { sendResetPassword }         from "@/services/email.service";
import { checkAuthRateLimit }        from "@/lib/auth-rate-limit";

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed, retryAfter } = checkAuthRateLimit(ip, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { ok: true },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    // Still 200 — don't reveal validation details
    return NextResponse.json({ ok: true });
  }

  const { email } = parsed.data;

  try {
    // Find the first active user with this email (any company).
    const user = await prisma.user.findFirst({
      where:  { email, isActive: true },
      select: { id: true, firstName: true, email: true },
    });

    if (user) {
      const token     = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      // Fire-and-forget — email failure must not affect the 200 response.
      void sendResetPassword({
        nombre: user.firstName,
        email:  user.email,
        token,
      });
    }
  } catch (err) {
    // Log but still return 200 to avoid leaking DB state.
    console.error("[POST /api/auth/forgot-password]", err);
  }

  return NextResponse.json({ ok: true });
}
