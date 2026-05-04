// Zod schemas for authentication boundaries: login, registration, session shape.
import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
  // Multi-tenant: identifies which company's user directory to authenticate against.
  companySlug: z.string().min(1).max(100),
});

export const RegisterSchema = z.object({
  // Multi-tenant: identifies which company the passenger is registering under.
  companySlug: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(60).trim(),
  lastName: z.string().min(1).max(60).trim(),
  phone: z.string().max(20).optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
