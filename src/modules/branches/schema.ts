// Zod schemas for branch create/update inputs.
import { z } from "zod";

export const CreateBranchSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1),
  address: z.string().optional(),
});

export const UpdateBranchSchema = CreateBranchSchema.partial().omit({ companyId: true });

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;
