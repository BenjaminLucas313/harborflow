// Audit repository: append-only writes and read queries for AuditLog.
// No service layer — callers write audit records directly via this repository.
// Never update or delete. No business logic.

import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LogActionData = {
  companyId: string;
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  ipAddress?: string;
};

/**
 * Appends an immutable audit record.
 * Fire-and-forget safe — callers may await or not depending on whether
 * audit failure should block the primary operation (usually it should not).
 */
export async function logAction(data: LogActionData): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: data.companyId,
      actorId: data.actorId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      payload: data.payload as Prisma.InputJsonValue,
      ipAddress: data.ipAddress,
    },
  });
}
