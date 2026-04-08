// Zod schemas for TripAllocation and SeatRequest inputs.
import { z } from "zod";

export const CreateAllocationSchema = z.object({
  tripId: z.string().min(1, "tripId is required"),
});

export const AddSeatRequestSchema = z.object({
  employeeId: z.string().min(1, "employeeId is required"),
  workTypeId: z.string().min(1, "workTypeId is required"),
});

export const SubmitAllocationSchema = z.object({
  allocationId: z.string().min(1),
});

export const ConfirmSeatRequestSchema = z.object({
  seatRequestId: z.string().min(1),
});

export const RejectSeatRequestSchema = z.object({
  seatRequestId: z.string().min(1),
  rejectionNote: z.string().optional(),
});

export type CreateAllocationInput = z.infer<typeof CreateAllocationSchema>;
export type AddSeatRequestInput = z.infer<typeof AddSeatRequestSchema>;
