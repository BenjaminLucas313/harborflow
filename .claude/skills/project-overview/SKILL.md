---
name: project-overview
description: Use this skill whenever you need to understand the architecture, domain boundaries, business rules, or implementation priorities of this repository before proposing changes.
---

# Project Overview Skill

## Purpose

This skill establishes architectural and domain context before implementation begins. Use it whenever a task touches multiple layers, when the request is ambiguous, or when there is a risk of implementing a locally correct but globally inconsistent change.

## Operating Directive

Before proposing code, produce a concise architecture and domain read of the task.

## Required Analysis Sequence

1. Identify the **feature area** or **domain module** involved.
2. Identify the **business rule(s)** the task affects.
3. Identify all impacted **roles**.
4. Identify likely impacted **entities / Prisma models**.
5. Identify affected layers:
   - UI
   - route handlers / server actions
   - service layer
   - persistence layer
   - notifications / audit / metrics
6. Identify if the task is:
   - greenfield
   - extension
   - refactor
   - migration-sensitive
7. Identify scale, tenant-isolation, and operational risks.

## Output Format

Return the analysis in this structure:

### Architectural Read
- Feature area
- Affected roles
- Affected entities
- Business rules touched
- Main risks

### Proposed Technical Direction
- Layering approach
- Files/modules likely needed
- Whether this change should be incremental or broad

### Guardrails
- Multi-tenant constraints
- Reservation/capacity constraints
- Port-operations constraints
- Audit requirements

## Repository-Specific Context

This repository is a production-oriented multi-tenant launch reservation and operations platform. Never assume single-tenant behavior. Never bypass reservation integrity. Never bury business-critical logic solely in the front-end.

## Anti-Patterns To Prevent

- UI-first implementation without server rule enforcement
- Schema edits without migration implications
- New feature implementation without role and audit review
- Cross-tenant leakage through unscoped queries
- Hidden changes to reservation semantics
