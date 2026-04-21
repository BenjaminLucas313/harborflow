import { z } from "zod";

export const CreateDepartmentSchema = z.object({
  companyId:   z.string(),
  name:        z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
});

export const UpdateDepartmentSchema = z.object({
  name:        z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  isActive:    z.boolean().optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
