import type { ErrorCode } from "@/lib/errors";

const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> & Record<string, string> = {
  // Trip
  TRIP_DEPARTURE_PAST:        "Este viaje ya partió y no acepta cambios",
  TRIP_AT_CAPACITY:           "El viaje está completo. ¿Querés sumarte a la lista de espera?",
  TRIP_ALREADY_CANCELLED:     "Este viaje fue cancelado",
  TRIP_NOT_BOOKABLE:          "El viaje no está disponible para reservas",
  TRIP_NOT_FOUND:             "El viaje no existe o fue eliminado",
  TRIP_DEPARTURE_TOO_SOON:    "El viaje parte en menos de una hora y ya no acepta cambios",
  TRIP_CAPACITY_INSUFFICIENT: "No hay suficientes lugares para la cantidad solicitada",
  // Port
  PORT_CLOSED: "El puerto está cerrado. Las operaciones se reanudan al reabrir.",
  // Auth
  UNAUTHORIZED:             "No tenés permisos para realizar esta acción",
  FORBIDDEN:                "Acceso denegado",
  EMAIL_ALREADY_REGISTERED: "Ya existe un usuario con ese email",
  INVALID_CREDENTIALS:      "Email o contraseña incorrectos",
  RATE_LIMITED:             "Hiciste muchas peticiones. Esperá unos minutos.",
  // Booking
  GROUP_BOOKING_NOT_CANCELLABLE: "Esta reserva ya no puede cancelarse",
  GROUP_BOOKING_NOT_FOUND:       "La reserva no existe",
  GROUP_BOOKING_NOT_DRAFT:       "La reserva ya fue enviada y no puede modificarse",
  GROUP_BOOKING_FORBIDDEN:       "No tenés acceso a esta reserva",
  CANCELLATION_TOO_LATE:         "Ya no es posible cancelar con menos de 2 horas de anticipación",
  // Slots
  SLOT_ALREADY_ASSIGNED: "Este usuario ya está asignado a este viaje",
  SLOT_NOT_PENDING:      "Este slot ya fue revisado anteriormente",
  SLOT_NOT_CONFIRMED:    "Este slot no está confirmado",
  SLOT_FORBIDDEN:        "No podés cancelar este slot",
  // Waitlist
  WAITLIST_ALREADY_JOINED: "Ya estás en la lista de espera para este viaje",
  WAITLIST_NOT_ENABLED:    "Este viaje no tiene lista de espera habilitada",
  // General
  NOT_FOUND:        "El recurso solicitado no existe",
  VALIDATION_ERROR: "Los datos enviados no son válidos",
  INTERNAL_ERROR:   "Ocurrió un error interno. Intentá de nuevo en un momento.",
};

export function getErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? "Ocurrió un error inesperado";
}
