---
name: auth-and-rbac
description: Use this skill when implementing or reviewing authentication flows, session handling, role-based access control, or post-login redirects with Auth.js v5 and Next.js App Router.
---

# Auth and RBAC Skill

## Purpose

Ensure authentication and role-based access control is correct, secure, and consistent across routes, middleware, and UI — with no role leakage, no redirect issues, and no authorization gaps.

## Stack Context

- Auth.js v5 (next-auth v5) with JWT strategy
- Next.js App Router
- Roles: UABL, EMPRESA, PROVEEDOR, USUARIO
- Session contains: user id, role, and department (for UABL)

## Session Rules

- Always extract session with `auth()` — never trust client-sent role or department
- Session must be validated at the start of every API route and server action
- If no session → redirect to login (UI) or return 401 (API)
- If wrong role → redirect to own dashboard (UI) or return 403 (API)
- Never expose other users' session data

## Role-to-Dashboard Mapping

| Role | Dashboard route |
|------|----------------|
| UABL | /dashboard/uabl |
| EMPRESA | /dashboard/empresa |
| PROVEEDOR | /dashboard/proveedor |
| USUARIO | /dashboard/usuario |

## Post-Login Redirect Rules

- After successful login, user must land directly on their role dashboard
- Never land on `/` after login
- Use `callbackUrl` carefully — validate it before redirecting to avoid open redirect
- In `auth.config.ts`, the `signIn` callback must return the role-based path
- In `middleware.ts`, authenticated users hitting `/` must be redirected to their dashboard
- Check both the `signIn` callback and the middleware redirect logic if the redirect is wrong

## Middleware Rules

- Public routes: `/`, `/login`, `/api/auth/[...nextauth]`
- All `/dashboard/*` routes require authentication
- Each dashboard subroute must verify the correct role
- UABL subroutes must also verify department match for approval actions

## RBAC Rules

### UABL
- Can only approve/reject requests belonging to its own department
- Can view global occupancy and seat data (read-only across all departments)
- Department is stored in session — derive from there, never from query params

### EMPRESA
- Must NOT be permanently tied to a department or sector
- Department/sector must be chosen per booking or request — not stored on the user
- If department is currently stored on the EMPRESA user record, this is a model error

### PROVEEDOR
- Can create and manage boats and trips
- Cannot access booking or approval flows

### USUARIO
- Can browse trips and make individual reservations
- No administrative access

## Auth.js v5 Checklist

- Is `auth()` called before any protected logic?
- Is the session role used (not a body/query param)?
- Does the `signIn` callback return the correct dashboard path?
- Does middleware redirect `/` to the role dashboard for authenticated users?
- Are public routes explicitly listed in matcher or middleware logic?
- Is JWT configured to include role and department in the token?

## Common Mistakes to Avoid

- Relying on `useSession()` alone for protection (client-side only, not secure)
- Forgetting to add role to the JWT token in the `jwt` callback
- Using `redirect('/')` after login instead of the role-based path
- Checking role from `req.body` or `searchParams` instead of session
- Not handling the case where session exists but role is undefined
