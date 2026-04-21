// Zod schemas for driver create/update inputs.
import { z } from "zod";

export const CreateDriverSchema = z.object({
  companyId: z.string(),
  branchId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  licenseNumber: z.string().optional(),
  phone: z.string().optional(),
});

export const UpdateDriverSchema = CreateDriverSchema.partial().omit({ companyId: true, branchId: true });

export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverInput = z.infer<typeof UpdateDriverSchema>;
