// Zod schemas for check-in inputs.
import { z } from "zod";

export const CheckInSchema = z.object({
  companyId: z.string(),
  reservationId: z.string(),
  checkedInByUserId: z.string(),
  notes: z.string().optional(),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;
