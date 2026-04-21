// Zod schemas for reservation booking, replacement, and cancellation inputs.
import { z } from "zod";

export const CreateReservationSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  tripId: z.string(),
});

export const ReplaceReservationSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  existingReservationId: z.string(),
  newTripId: z.string(),
});

export const CancelReservationSchema = z.object({
  reservationId: z.string(),
  companyId: z.string(),
  userId: z.string(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type ReplaceReservationInput = z.infer<typeof ReplaceReservationSchema>;
export type CancelReservationInput = z.infer<typeof CancelReservationSchema>;
