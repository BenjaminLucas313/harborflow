import { z } from "zod";

export const CreateEmployerSchema = z.object({
  companyId: z.string(),
  name:      z.string().min(1).max(200).trim(),
  taxId:     z.string().max(50).optional(),
});

export const UpdateEmployerSchema = z.object({
  name:     z.string().min(1).max(200).trim().optional(),
  taxId:    z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

export type CreateEmployerInput = z.infer<typeof CreateEmployerSchema>;
export type UpdateEmployerInput = z.infer<typeof UpdateEmployerSchema>;
