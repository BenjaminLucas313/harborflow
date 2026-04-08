import { z } from "zod";

export const CreateGroupBookingSchema = z.object({
  tripId: z.string(),
  notes:  z.string().max(500).optional(),
});

export const AddSlotSchema = z.object({
  usuarioId:         z.string(),
  workTypeId:        z.string(),
  representedCompany: z.string().min(1).max(200).trim(),
});

export const GroupBookingActionSchema = z.object({
  action: z.enum(["SUBMIT", "CANCEL"]),
});

export type CreateGroupBookingInput = z.infer<typeof CreateGroupBookingSchema>;
export type AddSlotInput = z.infer<typeof AddSlotSchema>;
export type GroupBookingActionInput = z.infer<typeof GroupBookingActionSchema>;
