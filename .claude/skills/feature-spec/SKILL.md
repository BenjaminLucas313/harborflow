---
name: feature-spec
description: Use this skill to convert a high-level product idea into an implementation-grade feature specification with domain rules, UX behavior, data implications, and acceptance criteria.
---

# Feature Specification Skill

## Purpose

Transform fuzzy requirements into an implementation-ready feature contract.

## When To Use

Use this skill when the user describes an idea informally, when scope is unclear, or before implementing medium/high impact changes.

## Required Deliverable

Produce a feature specification with the following sections.

## Output Template

# Feature Spec: <feature name>

## 1. Objective
Describe the operational or user problem being solved.

## 2. Actors
List which roles interact with the feature and how.

## 3. Functional Behavior
Describe the intended flow in explicit steps.

## 4. Business Rules
List all constraints, invariants, and system policies.

## 5. State Model
Define relevant states and transitions.

## 6. Data Model Impact
List affected models, new fields, relations, indexes, and migration considerations.

## 7. API / Server Contract
Define request/response behavior, validation, and failure cases.

## 8. UX Requirements
Define visual priorities, interaction constraints, empty states, error messaging, and accessibility considerations.

## 9. Edge Cases
List operational and concurrency-sensitive scenarios.

## 10. Telemetry / Audit
List events that should be logged or measured.

## 11. Acceptance Criteria
Provide testable criteria.

## 12. Suggested Delivery Plan
Split implementation into thin vertical slices.

## Repository-Specific Expectations

Always account for:
- multi-tenant scope
- low-tech passenger UX
- capacity enforcement
- waitlists
- replacement flows
- role-based access
- port closure and public notices when applicable

## Quality Bar

Do not stop at generic prose. Specifications must be implementation-shaped and should help a senior engineer begin work without re-deriving the domain.
