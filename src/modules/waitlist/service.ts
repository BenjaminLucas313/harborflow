// Waitlist service: join, cancel, promote.
// Position assignment is transactional (MAX(position)+1 within tripId).
// Promotion must validate passenger eligibility before creating a Reservation.
