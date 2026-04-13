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
});

export const UpdateTripStatusSchema = z.object({
  status: z.enum(Object.values(TripStatus) as [string, ...string[]]),
  statusReason: z.string().optional(),
});

export const UpdateTripSchema = CreateTripSchema.partial().omit({ companyId: true, branchId: true });

export type CreateTripInput = z.infer<typeof CreateTripSchema>;
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;
export type UpdateTripStatusInput = z.infer<typeof UpdateTripStatusSchema>;
