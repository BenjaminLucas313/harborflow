// Zod schemas for user create/update inputs. Email uniqueness is per-company.
import { z } from "zod";
import { UserRole } from "@prisma/client";

// V2 active roles only — legacy roles excluded from new registrations.
const V2_ROLES = [
  UserRole.USUARIO,
  UserRole.EMPRESA,
  UserRole.UABL,
  UserRole.PROVEEDOR,
] as const;

export const CreateUserSchema = z.object({
  companyId:    z.string(),
  branchId:     z.string().optional(),
  email:        z.email(),
  password:     z.string().min(8),
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  phone:        z.string().optional(),
  role:         z.enum(V2_ROLES).default(UserRole.USUARIO),
  // V2 additions
  departmentId: z.string().optional(), // UABL: which department to assign
  employerId:   z.string().optional(), // EMPRESA: which employer entity
  isUablAdmin:  z.boolean().default(false),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({
  companyId: true,
  password: true,
});

export const SearchUsuariosSchema = z.object({
  q: z.string().min(1).max(100),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type SearchUsuariosInput = z.infer<typeof SearchUsuariosSchema>;
