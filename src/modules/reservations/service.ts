// Reservation service: book, replace, cancel.
// All capacity checks and single-active-reservation enforcement live here.
// Every write must execute inside a transaction with a locking capacity query.
