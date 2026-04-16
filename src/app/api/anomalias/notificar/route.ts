// =============================================================================
// POST /api/anomalias/notificar
// =============================================================================
//
// Records that a UABL operator has manually escalated an anomaly.
// Creates an immutable audit entry — does NOT send external notifications.
//
// Auth:  UABL only (operators manage the response to anomalies).
//
// Body:
//   { anomaliaId: string; tipo: string; titulo: string }
//
// Response:
//   200 { ok: true }
//   400 VALIDATION_ERROR
//   401 UNAUTHORIZED
//   403 FORBIDDEN
//   500 INTERNAL_ERROR
//
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/lib/auth";
import { AppError }                  from "@/lib/errors";
import { assertRole }                from "@/lib/permissions";
import { logAction }                 from "@/modules/audit/repository";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No autorizado." } },
        { status: 401 },
      );
    }

    assertRole(session.user.role, ["UABL"]);

    // ── Body parsing ──────────────────────────────────────────────────────
    // Use .catch(() => null) so the outer try-catch handles auth/DB errors
    // separately from body-parse errors, and `body` is always defined below.
    const rawBody = await req.json().catch(() => null) as Record<string, unknown> | null;

    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Cuerpo JSON inválido." } },
        { status: 400 },
      );
    }

    // ── Field validation ──────────────────────────────────────────────────
    // anomaliaId is a synthetic runtime string (e.g. "lancha_baja_<boatId>").
    // It is never looked up in the DB — it is stored as-is in the audit log.
    const anomaliaId = typeof rawBody.anomaliaId === "string" ? rawBody.anomaliaId.trim() : "";
    const tipo       = typeof rawBody.tipo       === "string" ? rawBody.tipo.trim()       : "";
    const titulo     = typeof rawBody.titulo     === "string" ? rawBody.titulo.trim()     : "";

    if (!anomaliaId || !tipo || !titulo) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Campos requeridos: anomaliaId, tipo, titulo." } },
        { status: 400 },
      );
    }

    // ── Audit ─────────────────────────────────────────────────────────────
    await logAction({
      companyId:  session.user.companyId,
      actorId:    session.user.id,
      action:     "ANOMALIA_NOTIFICADA",
      entityType: "Anomalia",
      entityId:   anomaliaId,
      payload:    { tipo, titulo },
      ipAddress:  req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode },
      );
    }
    console.error("[POST /api/anomalias/notificar]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error interno." } },
      { status: 500 },
    );
  }
}
