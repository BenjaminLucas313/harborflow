import { z } from "zod";

export const CreateWorkTypeSchema = z.object({
  companyId:    z.string(),
  departmentId: z.string(),
  name:         z.string().min(1).max(100).trim(),
  code:         z.string().min(1).max(20).trim().toUpperCase(),
});

export const UpdateWorkTypeSchema = z.object({
  name:     z.string().min(1).max(100).trim().optional(),
  isActive: z.boolean().optional(),
});

export type CreateWorkTypeInput = z.infer<typeof CreateWorkTypeSchema>;
export type UpdateWorkTypeInput = z.infer<typeof UpdateWorkTypeSchema>;
