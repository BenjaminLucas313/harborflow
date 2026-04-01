// Zod schemas for operational notice create and deactivate inputs.
import { z } from "zod";

export const CreateNoticeSchema = z.object({
  companyId: z.string(),
  branchId: z.string(),
  // null = branch-wide notice; set = trip-specific notice.
  tripId: z.string().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  expiresAt: z.coerce.date().optional(),
  createdByUserId: z.string(),
});

export type CreateNoticeInput = z.infer<typeof CreateNoticeSchema>;
