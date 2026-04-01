// Zod schemas for authentication boundaries: login, registration, session shape.
import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  // Multi-tenant: identifies which company's user directory to authenticate against.
  companySlug: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
