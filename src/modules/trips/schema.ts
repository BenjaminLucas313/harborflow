// Zod schemas for trip create/update and status change inputs.
import { z } from "zod";
import { TripStatus } from "@prisma/client";

export const CreateTripSchema = z.object({
  companyId: z.string().optional(), // always overridden from session server-side
  branchId: z.string(),
  boatId: z.string(),
  driverId: z.string().optional(),
  departureTime: z.coerce.date(),
  estimatedArrivalTime: z.coerce.date().optional(),
  waitlistEnabled: z.boolean().default(true),
  notes: z.string().optional(),
  automatizado: z.boolean().default(false),
  /** "HH:MM" in Argentina local time (UTC-3). Required when automatizado = true. */
  horaRecurrente: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido")
    .optional(),
}).refine(
  (d) => !d.automatizado || !!d.horaRecurrente,
  { message: "horaRecurrente es requerida cuando automatizado es true", path: ["horaRecurrente"] },
);

export const UpdateTripStatusSchema = z.object({
  status: z.enum(Object.values(TripStatus) as [string, ...string[]]),
  statusReason: z.string().optional(),
});

// Defined from scratch — cannot use .partial() on a schema with .refine() in Zod v4.
// The refinement (horaRecurrente required when automatizado = true) is intentionally
// omitted here because a PATCH update may supply only a subset of fields.
export const UpdateTripSchema = z.object({
  boatId:               z.string().optional(),
  driverId:             z.string().optional(),
  departureTime:        z.coerce.date().optional(),
  estimatedArrivalTime: z.coerce.date().optional(),
  waitlistEnabled:      z.boolean().optional(),
  notes:                z.string().optional(),
  automatizado:         z.boolean().optional(),
  horaRecurrente:       z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido")
    .optional(),
});

export type CreateTripInput = z.infer<typeof CreateTripSchema>;
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;
export type UpdateTripStatusInput = z.infer<typeof UpdateTripStatusSchema>;
