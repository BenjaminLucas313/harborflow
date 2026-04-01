// Zod schema for audit log write input. AuditLog is immutable — no update schema.
import { z } from "zod";
import { AuditAction } from "@prisma/client";

export const CreateAuditLogSchema = z.object({
  companyId: z.string(),
  actorId: z.string().optional(),
  action: z.enum(Object.values(AuditAction) as [string, ...string[]]),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  ipAddress: z.string().optional(),
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
