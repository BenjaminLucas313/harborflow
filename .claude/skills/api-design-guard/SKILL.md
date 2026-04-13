---
name: api-design-guard
description: Use this skill when designing, reviewing, or debugging API routes to ensure consistent error handling, input validation, HTTP semantics, and response structure.
---

# API Design Guard Skill

## Purpose

Ensure all API routes are consistent, predictable, and debuggable — especially for multi-role systems where different clients consume the same endpoints.

## Core Principles

1. Every route must return a consistent response shape
2. Errors must include a machine-readable code and a human-readable message
3. HTTP status codes must be semantically correct
4. Input validation must happen before any DB query
5. Never expose internal error details to the client

## Response Shape

All endpoints must return:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo 'tripId' es requerido."
  }
}
```

Success:
```json
{
  "data": { ... },
  "error": null
}
```

## HTTP Status Codes

- 200: success
- 201: resource created
- 400: bad request / validation failure
- 401: not authenticated
- 403: authenticated but not authorized (wrong role)
- 404: resource not found
- 409: conflict (e.g. duplicate, overlap)
- 422: valid format but business rule violation
- 500: unexpected server error

## Error Codes (use in `error.code`)

- VALIDATION_ERROR — missing or malformed input
- NOT_FOUND — resource does not exist
- UNAUTHORIZED — no session
- FORBIDDEN — session exists but wrong role or department
- CONFLICT — duplicate or schedule overlap
- BUSINESS_RULE_VIOLATION — valid input but rule blocked it
- INTERNAL_ERROR — unexpected failure

## Input Validation Rules

- Validate all required fields before touching the DB
- Return 400 with VALIDATION_ERROR if any required field is missing
- Never trust client-sent role or department — always derive from session
- Coerce types explicitly (e.g. parseInt, trim strings)

## Route Review Checklist

- Does the route validate input before querying?
- Does it derive role/department from session, not from body?
- Does it return the correct HTTP status for each case?
- Does it return a consistent error shape with a code?
- Does it avoid leaking stack traces or Prisma errors to the client?
- Are 400 and 403 never confused?

## Common Mistakes to Avoid

- Returning 400 when the real issue is 403
- Returning 200 with `{ error: "..." }` in the body
- Letting Prisma throw bubble up as a 500 with raw message
- Validating input inside a try/catch instead of before it
- Returning `trips` directly instead of `{ data: trips, error: null }`

## Repository-Specific Notes

This project uses Next.js App Router API routes with Prisma and Auth.js v5.

- Always extract session with `auth()` at the top of the handler
- If no session → return 401 immediately
- If role mismatch → return 403 immediately
- The `/api/trips` route has a known 400 bug in the EMPRESA group booking flow — likely caused by missing or misnamed input field. Check field names against the client payload before assuming the route logic is wrong.
