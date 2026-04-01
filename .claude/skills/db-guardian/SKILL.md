---
name: db-guardian
description: Use this skill whenever a task touches Prisma schema, relational modeling, booking integrity, transactional behavior, indexing, or multi-tenant data boundaries.
---

# Database Guardian Skill

## Purpose

Protect data integrity, tenant boundaries, and booking correctness.

## Primary Responsibilities

- Review Prisma schema quality
- Validate relational modeling decisions
- Detect missing tenant scoping
- Detect reservation integrity risks
- Detect indexing blind spots
- Flag migration and transactional hazards

## Review Checklist

For every schema or persistence change, evaluate:

### 1. Entity Modeling
- Are names domain-accurate?
- Are relations explicit and understandable?
- Are enums appropriate and stable enough?
- Are soft-delete vs hard-delete semantics clear?

### 2. Tenant Isolation
- Does every tenant-owned entity have `companyId`?
- Does branch-scoped data include `branchId` where necessary?
- Can any query accidentally cross tenants?

### 3. Reservation Integrity
- Can capacity be oversold?
- Can a user hold more than one active reservation unintentionally?
- Is waitlist ordering stable?
- Are replacement flows modelled explicitly?

### 4. Transaction Design
- Which writes must be atomic?
- Which flows need optimistic vs pessimistic handling?
- Are race conditions likely under concurrent booking attempts?

### 5. Performance
- Are indexes needed for:
  - trip lookup by branch/time/status
  - reservations by user/status
  - waitlist lookup by trip/order
  - notices by branch/status/time
  - audit queries
- Are there accidental N+1 patterns implied by the schema usage?

### 6. Migration Safety
- Is this a breaking migration?
- Does data backfill need planning?
- Are defaults safe?
- Will production data violate the new constraint?

## Output Format

### DB Review Summary
- affected models
- integrity risks
- tenant risks
- migration risks
- indexing recommendations
- transactional recommendations

### Proposed Schema Direction
- concrete schema-level improvements
- naming corrections
- constraint/index suggestions

## Repository-Specific Guardrails

Never approve a schema change that:
- makes tenant scope optional where it should be mandatory
- weakens capacity enforcement semantics
- makes reservation history ambiguous
- hides operational closures or trip state transitions in free-form text only
