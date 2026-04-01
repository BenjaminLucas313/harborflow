// Zod schemas for port status change inputs.
import { z } from "zod";
import { PortStatusValue } from "@prisma/client";

export const SetPortStatusSchema = z.object({
  companyId: z.string(),
  branchId: z.string(),
  setByUserId: z.string(),
  status: z.enum(Object.values(PortStatusValue) as [string, ...string[]]),
  // Required for any non-OPEN status.
  message: z.string().optional(),
  estimatedReopeningAt: z.coerce.date().optional(),
});

export type SetPortStatusInput = z.infer<typeof SetPortStatusSchema>;
