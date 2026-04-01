---
name: port-operations
description: Use this skill for any feature related to port status, closures, delays, public notices, operational disruptions, and the impact of those changes on trips and reservations.
---

# Port Operations Skill

## Purpose

Model and implement operational control features around port status and service disruptions.

## Core Concerns

- branch or port operational state
- closure reasons
- public passenger communication
- reservation blocking behavior
- trip disruption handling
- operator/admin authority boundaries
- auditability

## Required Analysis

When port operations are involved, always answer:
1. Is the scope company-wide, branch-wide, or trip-specific?
2. Which roles can trigger the action?
3. Does the action block new reservations?
4. Does it affect already-booked passengers?
5. What public-facing notice should appear?
6. Is there an estimated reopening time?
7. What should happen to affected trips?
   - delayed
   - cancelled
   - left unchanged with notice
8. What events must be audited?

## Output Structure

### Operational Scenario
Describe the disruption or status change.

### Business Rule Impact
List impacted rules.

### Data Model Impact
List impacted tables/models and fields.

### UX / Messaging Requirements
Describe banner/modal/notice requirements.

### Implementation Notes
List service-layer and UI-layer implications.

### Audit / Metrics
List logs and analytics events.

## Repository-Specific Rules

Port closures must be highly visible and must not rely on a subtle UI treatment. Reservation blocking behavior must be deterministic. Public notices must support a clear custom message and optionally an estimated reopening time.
