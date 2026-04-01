// Audit repository: append-only writes and read queries for AuditLog.
// No service layer — callers write audit records directly via this repository.
// Never update or delete. No business logic.
