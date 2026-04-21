---
name: reservation-engine
description: Use this skill whenever working on reservation flows, booking rules, capacity enforcement, replacement logic, waitlists, and concurrency-sensitive booking operations.
---

# Reservation Engine Skill

## Purpose

This skill governs the core reservation domain of the platform.

Use it whenever a task affects:
- trip booking
- reservation replacement
- capacity enforcement
- waitlist behavior
- cancellation rules
- check-in implications on reservation state
- booking concurrency and transactional integrity
- user booking eligibility

This is one of the most critical skills in the repository because reservation correctness is a business-critical concern.

---

## Domain Mission

Implement and protect a reservation system that is:

- deterministic
- auditable
- transaction-safe
- role-aware
- tenant-safe
- easy for passengers to understand
- operationally reliable under concurrent usage

The booking engine must never behave like a demo.
It must behave like a production reservation system.

---

## Core Business Rules

### Rule 1 — Single Active Reservation
A passenger may only hold **one active reservation at a time** unless the product explicitly changes this policy.

“Active reservation” usually includes statuses such as:
- `CONFIRMED`
- `WAITLISTED`
- `CHECKED_IN` (depending on final policy and timing)

When evaluating eligibility, always use the current business definition of “active.”

---

### Rule 2 — Explicit Replacement Flow
If a passenger already has an active reservation and attempts to reserve another trip, the system must not silently fail and must not create duplicate active reservations.

Instead, the system must offer a **replacement flow**:
1. show the user that they already have an active reservation
2. explain clearly which reservation is currently active
3. ask whether they want to replace it
4. if confirmed, atomically cancel/replace the previous reservation and create the new one
5. preserve history and auditability

Replacement must be explicit, never implicit.

---

### Rule 3 — Capacity Must Never Be Oversold
Trip capacity is a hard invariant.

The system must never confirm more seats than the trip allows.

Capacity checks must be enforced:
- server-side
- close to the write operation
- in a concurrency-safe manner
- never based solely on stale client state

---

### Rule 4 — Waitlist Must Be Deterministic
When a trip is full and waitlist is enabled:
- users may join the waitlist
- ordering must be stable and deterministic
- promotion must follow a defined policy
- every promotion event must be traceable

Typical default:
- FIFO by creation timestamp or explicit queue position

If the promotion rule changes, that change must be intentional and documented.

---

### Rule 5 — Auditability
The system must preserve a clear history of reservation state changes.

Important events include:
- reservation created
- reservation replaced
- reservation cancelled
- waitlist entry created
- waitlist promotion
- reservation check-in
- reservation marked no-show
- reservation impacted by port closure or trip cancellation

Never model important state changes in a way that destroys history.

---

### Rule 6 — Reservation Logic Is Server-Owned
The front-end may guide the user, but the server owns reservation truth.

The UI must not be the final authority for:
- capacity
- active booking eligibility
- replacement validity
- waitlist position validity
- trip availability
- tenant/branch scope

---

## Reservation State Model

Use explicit status semantics.

Typical reservation statuses:
- `CONFIRMED`
- `WAITLISTED`
- `REPLACED`
- `CANCELLED`
- `CHECKED_IN`
- `NO_SHOW`

Optional variants if needed:
- `CANCELLED_BY_USER`
- `CANCELLED_BY_OPERATOR`
- `CANCELLED_BY_SYSTEM`
- `CANCELLED_TRIP_DISRUPTION`
- `REPLACED_BY_NEW_BOOKING`

Prefer clear enum modeling when state semantics matter operationally.

---

## Booking Eligibility Checks

Before creating a reservation, always evaluate:

1. Is the user authenticated and authorized?
2. Is the trip in a reservable state?
3. Is the trip in the correct tenant and branch scope?
4. Is the port open for booking?
5. Does the user already hold an active reservation?
6. Does the trip have capacity?
7. If no capacity exists, is waitlist enabled?
8. Are there business rules preventing the booking? Example:
   - booking window closed
   - user blocked
   - duplicate waitlist entry
   - trip already departed

---

## Replacement Flow Requirements

When implementing replacement logic, always account for:

### User Experience
- tell the user they already have a reservation
- identify the currently reserved trip clearly
- explain the consequence of replacement
- require explicit confirmation

### Domain Logic
- previous reservation must be transitioned intentionally
- new reservation creation and old reservation replacement must be coordinated
- do not allow both reservations to remain active
- write an audit event
- ensure idempotency if possible

### Persistence / Transaction
Replacement is a high-risk write flow.

Evaluate whether this flow must be performed inside a transaction.
At minimum, prevent partial completion such as:
- old reservation cancelled but new one not created
- new reservation created but old one still active

---

## Waitlist Rules

When a trip is full:

### Joining Waitlist
- user may join only if policy allows
- must not create duplicate waitlist entries
- must respect single-active-reservation policy if applicable
- must be tenant- and branch-scoped properly

### Promotion
If a seat becomes available:
- identify the next eligible waitlist entry
- verify that the user is still eligible
- promote deterministically
- update reservation/waitlist state clearly
- log the promotion
- optionally notify the user

### Edge Cases
- user already has another active reservation by promotion time
- user was removed or blocked
- trip is cancelled before promotion
- port closes before promotion completes
- multiple seats open simultaneously
- multiple promotions race concurrently

---

## Capacity Enforcement Guidance

Capacity is not a UI problem.
Capacity is a write-consistency problem.

Always review:
- where confirmed seat count is computed
- whether waitlisted users are excluded properly
- whether checked-in users still count toward occupancy
- whether cancelled/replaced reservations stop counting
- how concurrent booking attempts are handled

Recommended mindset:
- confirmed reservations consume capacity
- waitlisted reservations do not
- replaced/cancelled reservations do not
- checked-in reservations still belong to confirmed occupancy unless explicitly modeled differently

---

## Concurrency and Transactional Safety

This domain is concurrency-sensitive.

Always ask:
1. What happens if two users reserve the last seat simultaneously?
2. What happens if a replacement flow and a cancellation happen at the same time?
3. What happens if waitlist promotion occurs while a trip is being cancelled?
4. What happens if check-in is attempted on an invalid reservation state?

Whenever reservation integrity is at risk, prefer:
- transactional boundaries
- row-level locking or safe equivalent patterns
- retry-aware design where appropriate
- explicit conflict handling

Do not hand-wave concurrency concerns.

---

## Multi-Tenant Guardrails

Every reservation-related action must respect tenant boundaries.

Always verify:
- reservation belongs to the same `companyId`
- if branch-scoped, `branchId` is correct
- trip lookup is scoped correctly
- waitlist lookup is scoped correctly
- no cross-tenant promotion, notification, or reporting occurs

Never write reservation queries that assume one global namespace.

---

## Port / Trip Disruption Interaction

Reservation logic must integrate with operational events.

Examples:
- port closes → future reservations may be blocked
- trip is delayed → reservations remain valid but UI state changes
- trip is cancelled → reservations transition accordingly
- trip is reopened or capacity changes → waitlist rules may be triggered

Whenever disruptions affect reservations, define:
- new reservation state
- user-facing message
- audit event
- notification behavior

---

## API / Service Design Expectations

When implementing reservation endpoints or server actions:

### Validate Input
Use runtime validation such as Zod.

### Return Explicit Outcomes
Prefer structured outcome types like:
- success: reservation confirmed
- success: waitlist entry created
- blocked: active reservation exists
- blocked: replacement confirmation required
- blocked: no capacity and waitlist disabled
- blocked: port closed
- blocked: trip unavailable
- error: concurrency conflict

### Avoid Ambiguous Responses
The caller should always know:
- what happened
- why it happened
- what the user can do next

---

## Recommended Output Contract When Using This Skill

When asked to design or modify reservation logic, respond in this structure:

### Reservation Impact Summary
- feature/change requested
- affected business rules
- affected roles
- affected entities/models

### Logic Design
- eligibility checks
- state transitions
- capacity behavior
- waitlist behavior
- replacement behavior

### Data / Transaction Notes
- tables/models involved
- constraints/indexes involved
- transaction boundaries needed
- concurrency risks

### UX Contract
- user-facing success states
- user-facing blocking states
- replacement confirmation messaging
- waitlist messaging

### Test Plan
List the most important test cases.

---

## Required Test Cases

At minimum, think through and recommend tests for:

### Booking
- user books a trip with available capacity
- user cannot book if trip is unavailable
- user cannot book across invalid tenant scope

### Single Active Reservation
- user with active reservation is blocked from direct second booking
- user can explicitly replace existing reservation
- old reservation is no longer active after replacement

### Capacity
- last seat can only be taken once
- concurrent booking attempts do not oversell
- cancelled reservation frees capacity

### Waitlist
- full trip creates waitlist entry when enabled
- duplicate waitlist entry is rejected
- first eligible user is promoted when seat opens
- ineligible waitlist user is skipped safely

### Disruptions
- booking blocked when port is closed
- reservation affected correctly when trip is cancelled
- waitlist not promoted into invalid trip state

### Check-In
- confirmed reservation can be checked in
- cancelled or replaced reservation cannot be checked in
- no-show logic is enforced properly if implemented

---

## Anti-Patterns To Prevent

Never:
- trust client-side capacity counts
- create bookings without checking active reservation policy
- auto-replace reservations without explicit user intent
- model waitlist as an afterthought with unstable ordering
- delete reservation history to represent state changes
- ignore tenant scoping in booking queries
- implement booking success paths without conflict handling
- let UI wording hide domain ambiguity

---

## Repository-Specific Guidance

This project is a professional reservation and operations platform for launch/boat transport.

That means:
- booking rules affect real operations
- passengers may have low digital confidence
- operators need deterministic manifests
- admins need reliable analytics
- disruptions like port closures are first-class events

The reservation engine should therefore optimize for:
- correctness
- clarity
- auditability
- operational predictability
- extensibility

---

## Final Instruction

When this skill is active, think like a senior backend engineer responsible for the integrity of the booking engine.

Do not optimize for speed of coding at the expense of:
- business correctness
- tenant safety
- transactional reliability
- user clarity
- traceability