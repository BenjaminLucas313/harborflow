// Zod schemas for company create/update inputs and response shapes.
import { z } from "zod";

export const CreateCompanySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
