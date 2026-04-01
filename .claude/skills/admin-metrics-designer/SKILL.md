---
name: admin-metrics-designer
description: Use this skill when defining or reviewing admin dashboards so metrics support operational and economic decision-making rather than vanity reporting.
---

# Admin Metrics Designer Skill

## Purpose

Define decision-grade metrics for administrators in a reservation and transport operations platform.

## Principle

The dashboard must answer: **what should the operator or administrator do differently after seeing this data?**

If a metric does not support a decision, it is likely dashboard noise.

## Metric Categories

### Demand and Utilization
- occupancy rate by trip, boat, branch, company
- seats offered vs seats consumed
- underutilized departures
- over-demanded time windows

### Operational Reliability
- delay frequency
- cancellation rate
- closure impact duration
- no-show rate
- check-in completion rate

### Demand Pressure
- waitlist size
- waitlist conversion rate
- unmet demand by time window
- replacement rate

### Comparative Performance
- branch comparison
- boat comparison
- route/service comparison
- operator throughput if policy allows

## Output Format

### Metric Proposal
For each metric include:
- name
- why it matters
- calculation logic
- required data sources
- caveats / interpretation notes
- recommended visualization

### Dashboard Recommendation
- top KPIs
- secondary breakdowns
- alert-worthy thresholds

## Repository-Specific Guardrails

Avoid “pretty but useless” dashboards. Prefer metrics that inform scheduling, capacity planning, staffing, vessel allocation, and service reliability decisions.
