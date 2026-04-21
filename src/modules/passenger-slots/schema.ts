import { z } from "zod";

export const ReviewSlotSchema = z.object({
  action:        z.enum(["CONFIRM", "REJECT"]),
  rejectionNote: z.string().max(500).optional(),
}).refine(
  (d) => d.action === "CONFIRM" || (d.action === "REJECT" && !!d.rejectionNote?.trim()),
  { message: "Se requiere un motivo al rechazar un slot.", path: ["rejectionNote"] },
);

export type ReviewSlotInput = z.infer<typeof ReviewSlotSchema>;
