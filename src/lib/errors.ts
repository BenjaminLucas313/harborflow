// AppError class and typed error codes for structured error handling across the app.

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ErrorCode =
  // ── V1 Reservation (legacy) ────────────────────────────────────────────────
  | "RESERVATION_ALREADY_ACTIVE"
  | "RESERVATION_NOT_FOUND"
  | "RESERVATION_ALREADY_CANCELLED"
  // ── Trip ───────────────────────────────────────────────────────────────────
  | "TRIP_AT_CAPACITY"
  | "TRIP_NOT_FOUND"
  | "TRIP_NOT_BOOKABLE"
  // ── V1 Waitlist (legacy) ───────────────────────────────────────────────────
  | "WAITLIST_ALREADY_JOINED"
  | "WAITLIST_NOT_ENABLED"
  // ── Port ───────────────────────────────────────────────────────────────────
  | "PORT_CLOSED"
  // ── V2 Group Booking ───────────────────────────────────────────────────────
  | "GROUP_BOOKING_NOT_FOUND"
  | "GROUP_BOOKING_NOT_DRAFT"        // Tried to add/remove slots after submission
  | "GROUP_BOOKING_NOT_SUBMITTED"    // Tried to review before submission
  | "GROUP_BOOKING_FORBIDDEN"        // EMPRESA tried to access another employer's booking
  // ── V2 Passenger Slot ──────────────────────────────────────────────────────
  | "SLOT_NOT_FOUND"
  | "SLOT_ALREADY_ASSIGNED"          // USUARIO already on this trip (@@unique violated)
  | "SLOT_NOT_PENDING"               // UABL tried to review an already-reviewed slot
  | "SLOT_FORBIDDEN"                 // Tried to cancel a slot that's not yours
  // ── V2 Authorization ───────────────────────────────────────────────────────
  | "UNAUTHORIZED_DEPARTMENT"        // UABL user's dept doesn't match slot's dept
  // ── V2 Entity not found ────────────────────────────────────────────────────
  | "USUARIO_NOT_FOUND"
  | "EMPLOYER_NOT_FOUND"
  | "DEPARTMENT_NOT_FOUND"
  | "WORKTYPE_NOT_FOUND"
  // ── Auth / User ────────────────────────────────────────────────────────────
  | "EMAIL_ALREADY_REGISTERED"
  | "COMPANY_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  // ── General ────────────────────────────────────────────────────────────────
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";
