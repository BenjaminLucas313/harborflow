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
  // Reservation
  | "RESERVATION_ALREADY_ACTIVE"
  | "RESERVATION_NOT_FOUND"
  | "RESERVATION_ALREADY_CANCELLED"
  | "TRIP_AT_CAPACITY"
  // Waitlist
  | "WAITLIST_ALREADY_JOINED"
  | "WAITLIST_NOT_ENABLED"
  // Trip
  | "TRIP_NOT_FOUND"
  | "TRIP_NOT_BOOKABLE"
  // Port
  | "PORT_CLOSED"
  // Auth
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  // General
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";
