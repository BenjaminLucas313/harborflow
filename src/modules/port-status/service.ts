// Port status service: append new status record (immutable log).
// Non-OPEN status must include a message. May trigger downstream trip/reservation effects.
import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import { appendPortStatus } from "./repository";
import type { SetPortStatusInput } from "./schema";

export async function setPortStatus(input: SetPortStatusInput) {
  const isOpen = input.status === "OPEN";

  if (!isOpen && !input.message) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Se requiere un mensaje cuando el puerto no está abierto.",
      400,
    );
  }

  const record = await appendPortStatus(input);

  // Fire-and-forget audit log — does not block the response.
  logAction({
    companyId: input.companyId,
    actorId: input.setByUserId,
    action: isOpen ? "PORT_OPENED" : "PORT_CLOSED",
    entityType: "PortStatus",
    entityId: record.id,
    metadata: { status: input.status, message: input.message ?? null },
  }).catch(() => {});

  return record;
}
