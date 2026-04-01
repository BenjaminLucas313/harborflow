// Zod schemas for boat create/update inputs.
import { z } from "zod";

export const CreateBoatSchema = z.object({
  companyId: z.string(),
  branchId: z.string(),
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  description: z.string().optional(),
});

export const UpdateBoatSchema = CreateBoatSchema.partial().omit({ companyId: true, branchId: true });

export type CreateBoatInput = z.infer<typeof CreateBoatSchema>;
export type UpdateBoatInput = z.infer<typeof UpdateBoatSchema>;
