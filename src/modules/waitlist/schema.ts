// Zod schemas for waitlist join and cancellation inputs.
import { z } from "zod";

export const JoinWaitlistSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  tripId: z.string(),
});

export const CancelWaitlistSchema = z.object({
  entryId: z.string(),
  companyId: z.string(),
  userId: z.string(),
});

export type JoinWaitlistInput = z.infer<typeof JoinWaitlistSchema>;
export type CancelWaitlistInput = z.infer<typeof CancelWaitlistSchema>;
