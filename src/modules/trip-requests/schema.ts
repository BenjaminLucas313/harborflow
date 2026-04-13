import { z } from "zod";

export const CreateTripRequestSchema = z.object({
  origin:         z.string().min(1, "El origen es obligatorio.").max(200).trim(),
  destination:    z.string().min(1, "El destino es obligatorio.").max(200).trim(),
  requestedDate:  z.coerce.date({ required_error: "La fecha es obligatoria." }),
  passengerCount: z
    .number({ required_error: "La cantidad de personas es obligatoria." })
    .int()
    .min(1, "Debe haber al menos 1 persona.")
    .max(500, "El límite es 500 personas."),
  notes: z.string().max(1000).optional(),
});

export const ReviewTripRequestSchema = z
  .object({
    action:        z.enum(["ACCEPT", "REJECT"]),
    boatId:        z.string().optional(),
    rejectionNote: z.string().max(500).optional(),
  })
  .refine(
    (d) => d.action !== "ACCEPT" || !!d.boatId?.trim(),
    { message: "Se requiere una embarcación para aceptar la solicitud.", path: ["boatId"] },
  )
  .refine(
    (d) => d.action !== "REJECT" || !!d.rejectionNote?.trim(),
    { message: "Se requiere un motivo para rechazar la solicitud.", path: ["rejectionNote"] },
  );

export type CreateTripRequestInput = z.infer<typeof CreateTripRequestSchema>;
export type ReviewTripRequestInput = z.infer<typeof ReviewTripRequestSchema>;
