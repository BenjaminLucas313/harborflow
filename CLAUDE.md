# CLAUDE.md

## Project Identity

**Project name:** HarborFlow
**Product type:** Multi-tenant water transport reservation and operations platform
**Primary domain:** Boat / launch trip reservation, dispatch, embarkation, port operations, passenger communication, waitlists, check-in, and operational metrics
**Target users:**
- Passengers with low technical literacy
- Port operators running real-time operations
- Company administrators managing fleet, schedules, and analytics
- Multi-company / multi-branch deployments

## Product Vision

Build a production-grade, mobile-first, operationally reliable reservation platform for launch services. The system must support:
- public trip discovery
- authenticated passenger reservations
- capacity enforcement
- waitlist promotion
- reservation replacement flows
- operator-driven embarkation workflows
- public port status communication
- temporary port closure and reopening
- multi-company and multi-branch tenancy
- admin-grade operational and economic analytics

The product is not a toy project. It must be architected with professional engineering standards, explicit business rules, maintainable domain boundaries, and a path to scale.

## Non-Negotiable Business Rules

1. A passenger may only hold **one active reservation at a time** across reservable trips, unless explicitly changed by product rules.
2. If a passenger attempts to reserve another trip while already holding an active reservation, the system must offer a **reservation replacement flow** instead of silently failing.
3. The system must **never oversell capacity**.
4. When a trip reaches capacity, new requests should enter a **waitlist** when enabled.
5. Waitlist promotion must be deterministic and auditable.
6. Operators and admins can manage **port status**. Port status may block reservations and must produce a visible public notice.
7. The public UI must prioritize **clarity, legibility, accessibility, and error prevention** over visual novelty.
8. Users do **not** pay through the platform in V1.
9. The project must be designed as **multi-tenant** from the data model upward, even if initial deployment starts with a single company.
10. Every operationally significant action must be traceable in an audit log.

## Roles and Capabilities

### Passenger
- Register and authenticate
- Browse future trips
- View trip details
- Create reservation
- Replace active reservation
- View active reservation status
- Join waitlist when a trip is full
- Receive reservation and disruption notices

### Operator
- Manage operational trip state
- Perform passenger check-in
- Mark embarkation progress
- View manifest and occupancy
- Open / close the port
- Publish operational notices
- Trigger trip-specific or port-wide disruption handling

### Administrator
- Full CRUD on companies, branches, boats, drivers, trips, schedules, and users
- Full reservation oversight
- Waitlist and disruption oversight
- Analytics access
- Policy configuration
- Role management
- Audit visibility

## Core Domain Concepts

- **Company**: top-level tenant
- **Branch**: operational location / port / service point inside a company
- **PortStatus**: real-time operational state of a branch or port
- **Boat**: vessel with capacity and operational metadata
- **Driver**: trip operator / pilot / captain
- **Trip**: scheduled departure with departure time, capacity, operator assignment, and status
- **Reservation**: passenger booking for a trip
- **WaitlistEntry**: ordered fallback queue when a trip is full
- **CheckIn**: embarkation attendance record
- **OperationalNotice**: public-facing message tied to port or trip status
- **AuditLog**: immutable trace of sensitive actions

## Target Architecture

### Application Architecture
Use a **modular monolith** first, not microservices.

Preferred stack:
- Next.js (App Router)
- TypeScript (strict mode)
- PostgreSQL
- Prisma ORM
- Zod for runtime validation and schema boundaries
- React Hook Form for forms
- shadcn/ui for reusable UI primitives
- Tailwind CSS
- NextAuth/Auth.js or equivalent session/auth solution appropriate to the final stack decision

### Architectural Principles
1. Keep domain logic on the **server**, not only in the UI.
2. Avoid fat page components. Prefer feature-level modules.
3. Separate:
   - domain logic
   - application services / use cases
   - persistence
   - presentation
4. Use explicit DTO validation at boundaries.
5. Prefer idempotent and auditable write paths.
6. Design for multi-tenant enforcement from the first schema version.
7. Optimize for correctness before premature optimization.
8. Write code that is easy to extend for V2 operational workflows.

## Multi-Tenant Rules

- Every tenant-owned entity must belong to a `companyId`.
- Branch-scoped entities must also include `branchId`.
- Never write business logic that assumes a single company.
- Tenant boundaries must be enforceable at query level and service level.
- Avoid leaking cross-tenant data in shared tables or caches.

## UI/UX Requirements

The audience includes users with low technical confidence.

Therefore:
- mobile-first layouts are mandatory
- primary actions must be visually obvious
- warnings and confirmations must be large and unambiguous
- destructive actions must require clear confirmation
- use step-based flows where appropriate
- use explicit labels instead of clever copy
- accessibility and readability matter more than decorative complexity
- error states must explain what happened and what the user should do next

### UX Priorities
1. Prevent invalid actions before submission when possible
2. Make system state visible
3. Make operational disruptions impossible to miss
4. Keep booking flow short
5. Preserve trust with deterministic feedback

## Operational State Model

### Port Status
Supported states:
- `OPEN`
- `PARTIALLY_OPEN`
- `CLOSED_WEATHER`
- `CLOSED_MAINTENANCE`
- `CLOSED_SECURITY`
- `CLOSED_OTHER`

A port status change may:
- block reservations
- mark upcoming trips as delayed/cancelled
- trigger public notices
- require operator/admin attribution

### Trip Status
Suggested states:
- `SCHEDULED`
- `BOARDING`
- `FULL`
- `DELAYED`
- `CANCELLED`
- `DEPARTED`
- `COMPLETED`

### Reservation Status
Suggested states:
- `CONFIRMED`
- `WAITLISTED`
- `REPLACED`
- `CANCELLED`
- `CHECKED_IN`
- `NO_SHOW`

## Reservation Policy

Default policy in V1:
- One active reservation per passenger
- Replacement flow must be explicit and confirmed by the user
- If replacement succeeds, previous reservation becomes `REPLACED` or `CANCELLED_REPLACED` depending on final enum design
- Capacity checks must happen server-side inside a transaction-safe flow
- Waitlist promotion rules must be deterministic and logged

## Metrics Philosophy

Do not build vanity dashboards.
Focus on metrics that support actual operational and economic decisions.

Examples:
- occupancy rate by trip / boat / branch / company
- no-show rate
- cancellation rate
- waitlist pressure
- unmet demand
- seat utilization over time
- delay and closure impact
- trips filled vs underutilized
- promotion rate from waitlist
- replacement frequency

## Engineering Standards

### TypeScript
- Strict mode on
- Avoid `any`
- Prefer discriminated unions for stateful workflows
- Prefer explicit return types on exported functions

### Prisma / DB
- Use clear relation names
- Add indexes for high-frequency lookups
- Prefer explicit enum modeling when states are stable
- Audit schema changes carefully
- Consider transaction boundaries for booking flows

### API / Server Actions / Route Handlers
- Validate all input with Zod
- Return structured error contracts
- Never trust client-calculated state

### React
- Prefer server-first rendering where useful
- Keep client components minimal and intentional
- Extract reusable feature components
- Do not bury business rules in component trees

### Code Quality
- Keep functions focused and named by intent
- Favor feature folders over random utility sprawl
- Avoid hidden coupling
- Leave clear comments only where domain intent is non-obvious

## Testing Priorities

Prioritize tests around:
- reservation replacement flow
- capacity enforcement
- waitlist promotion
- port closure behavior
- role-based permissions
- multi-tenant data isolation
- trip check-in and no-show transitions

## Git Workflow

- Use short-lived branches
- Branch naming examples:
  - `feat/reservation-replacement`
  - `feat/port-status-banner`
  - `fix/waitlist-promotion-race`
  - `refactor/trip-service-layer`
- Prefer small, coherent commits
- Do not mix schema refactors, UI redesign, and business logic changes in one commit

## How Claude Should Work In This Repository

When helping in this project, always:
1. Identify the affected domain entities first
2. Identify the business rule changes second
3. Identify persistence implications third
4. Then propose UI/API changes
5. Call out risks, edge cases, and migration impacts
6. Prefer production-safe patterns over demo shortcuts
7. Explain tradeoffs briefly but precisely

Before implementing changes, explicitly answer:
- What domain behavior is changing?
- What tables/models are affected?
- What user roles are affected?
- What edge cases or race conditions exist?
- What tests should protect this change?

Do not:
- introduce unnecessary dependencies casually
- redesign architecture without justification
- assume single-tenant behavior
- move business-critical logic exclusively into the client
- produce vague pseudo-enterprise abstractions with no delivery value

## Preferred Response Format For This Project

When proposing or editing code, structure your response as:
1. **Goal**
2. **Domain impact**
3. **Files to change**
4. **Implementation plan**
5. **Code**
6. **Risks / follow-ups**

## Initial Feature Priorities

1. Project scaffolding
2. Authentication and role model
3. Company / branch tenancy model
4. Boat, driver, and trip management
5. Reservation flow
6. Replacement flow
7. Waitlist
8. Port closure and public notices
9. Check-in
10. Admin analytics

## Definition of Done

A task is not done unless:
- business rules are respected
- validation exists
- role access is correct
- multi-tenant scope is preserved
- happy path works
- obvious edge cases are covered
- code is readable and maintainable
- the UI communicates state clearly

## Available Skills

Skills are located in `.claude/skills/`. Claude should consult the relevant skill before working on any task in that domain.

- `api-design-guard` — API route structure, error codes, response shape
- `auth-and-rbac` — Auth.js v5, session handling, role redirects, RBAC rules
- `prisma-patterns` — Query patterns, transactions, migrations, error mapping
- `error-handling` — Error classification, server/client error propagation
- `form-validation` — Zod schemas, inline errors, client+server validation
- `ui-ux-guard` — Accessibility, mobile-first, operational clarity
- `ui-animations-pro` — Motion guidelines, feedback animations
- `db-guardian` — (ya existente)
- `admin-metrics` — (ya existente)
- `feature-spec` — (ya existente)
- `git-workflow` — (ya existente)
- `port-operations` — (ya existente)
- `project-overview` — (ya existente)
- `reservation-engine` — (ya existente)

## Reglas generales
- SIEMPRE leer la skill relevante antes de implementar
- NUNCA hardcodear strings de estado — usar enums de Prisma
- SIEMPRE validar fechas con timezone Argentina (UTC-3)
- Los endpoints de API deben seguir el patrón en `api-design-guide`
- Toda migración de DB pasa por `db-guardian` primero