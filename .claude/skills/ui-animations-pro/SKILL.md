---
name: ui-animations-pro
description: Use this skill when implementing UI animations to ensure they enhance clarity, feedback, and usability without harming performance or accessibility.
---

# UI Animations Professional Skill

## Purpose

Design and implement animations that improve user understanding, feedback, and flow — not decoration.

This system prioritizes:
- clarity
- responsiveness
- low cognitive load
- operational visibility

## Core Principles

1. Animations must communicate state changes
2. Animations must never block user actions
3. Avoid long or complex transitions
4. Prefer subtle, fast, and meaningful motion
5. Mobile performance is critical

## Allowed Use Cases

- button feedback (press, loading)
- confirmation transitions
- modal open/close
- reservation success feedback
- error indication
- list updates (new trip, waitlist changes)
- check-in confirmation
- port status alerts appearing

## Forbidden Use Cases

- decorative animations with no meaning
- long transitions (>300ms unless justified)
- animations that delay user interaction
- heavy motion on low-end devices
- complex choreography

## Motion Guidelines

- duration: 100ms – 250ms
- easing: ease-out or standard cubic
- use opacity + slight translate
- avoid large movement distances

## Accessibility

- respect reduced motion preferences
- ensure information is not animation-dependent
- always pair motion with text feedback

## Example Patterns

### Success Action
- slight scale up + fade
- success message appears

### Error
- subtle shake or color highlight
- immediate message

### Modal
- fade + small translateY

### List Update
- fade in, not slide from far away

## Output Format

When proposing animations:

### Animation Goal
What feedback does it provide?

### Component
Where is it applied?

### Motion Strategy
Type, duration, easing

### Code Example
Provide implementation (Framer Motion or CSS)

## Repository-Specific Rule

This system serves users with low technical literacy.

Animations must:
- reduce confusion
- reinforce trust
- never distract