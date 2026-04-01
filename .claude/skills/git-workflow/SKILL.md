---
name: git-workflow
description: Use this skill to propose a safe Git workflow for the current change, including branch naming, commit slicing, rollback safety, and review strategy.
---

# Git Workflow Skill

## Purpose

Guide change delivery using a disciplined, low-risk Git workflow suitable for a learning developer working on a production-grade codebase.

## Responsibilities

- recommend branch naming
- define commit plan
- separate risky changes from safe changes
- make rollback paths obvious
- reduce accidental scope creep

## Output Format

### Suggested Branch
Provide one branch name.

### Commit Plan
Break the work into 2-6 coherent commits with precise commit messages.

### Risk Notes
Identify files or changes that deserve isolation.

### Rollback Notes
Explain the easiest safe rollback strategy.

## Commit Message Style
Use imperative, scope-aware messages, for example:
- `feat(trips): add trip creation service and validation`
- `feat(reservations): enforce single active booking policy`
- `feat(port-status): add branch-wide closure banner`
- `refactor(ui): extract reservation summary card`
- `fix(waitlist): preserve deterministic promotion ordering`

## Repository-Specific Advice

Strongly encourage separating:
- schema changes
- service-layer business rules
- UI work
- test additions

Never recommend one giant “do everything” commit for changes that affect booking integrity or tenant boundaries.
