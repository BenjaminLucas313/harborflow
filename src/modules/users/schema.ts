// Zod schemas for user create/update inputs. Email uniqueness is per-company.
import { z } from "zod";
import { UserRole } from "@prisma/client";

export const CreateUserSchema = z.object({
  companyId: z.string(),
  branchId: z.string().optional(),
  email: z.email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(Object.values(UserRole) as [string, ...string[]]).default(UserRole.PASSENGER),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ companyId: true, password: true });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
