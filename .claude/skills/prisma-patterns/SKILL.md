---
name: prisma-patterns
description: Use this skill when writing, reviewing, or debugging Prisma queries, schema changes, migrations, or data access patterns in this project.
---

# Prisma Patterns Skill

## Purpose

Ensure Prisma usage is efficient, safe, and consistent — avoiding N+1 queries, unsafe migrations, and model design errors that leak into business logic.

## Stack Context

- Prisma ORM with PostgreSQL
- Next.js App Router (queries run in server components, server actions, and API routes)
- Multi-role system: UABL, EMPRESA, PROVEEDOR, USUARIO
- Local DB has been migrated and seeded for V2

## Schema Design Rules

- Every model must have a single `id` field as primary key (cuid or uuid)
- Use explicit relation names when a model has multiple relations to the same target
- Never store role or department on a user as a mutable string — use enums
- EMPRESA users must NOT have a permanent `departmentId` on their record — department is chosen per booking
- Soft deletes: use `deletedAt DateTime?` instead of hard deletes for bookings and trips
- Timestamps: all models must have `createdAt` and `updatedAt`

## Query Patterns

### Always use select or include explicitly
Never return full model objects when only a subset of fields is needed.

```ts
const trip = await prisma.trip.findUnique({
  where: { id: tripId },
  select: { id: true, date: true, boatId: true, availableSeats: true }
})
```

### Avoid N+1 — use include or separate batch queries
Bad:
```ts
const bookings = await prisma.booking.findMany()
for (const b of bookings) {
  const trip = await prisma.trip.findUnique({ where: { id: b.tripId } })
}
```

Good:
```ts
const bookings = await prisma.booking.findMany({
  include: { trip: true }
})
```

### Use transactions for multi-step writes
Any operation that writes to more than one table must use a transaction.

```ts
await prisma.$transaction([
  prisma.booking.create({ data: { ... } }),
  prisma.trip.update({ where: { id: tripId }, data: { availableSeats: { decrement: seats } } })
])
```

### Filtering trips by date and boat
A boat can do multiple trips per day — never filter by `date + boatId` as a uniqueness constraint. Only block on actual schedule overlap.

```ts
const conflicts = await prisma.trip.findMany({
  where: {
    boatId,
    date,
    AND: [
      { departureTime: { lt: requestedArrival } },
      { arrivalTime: { gt: requestedDeparture } }
    ]
  }
})
```

## Migration Rules

- Never edit a migration file that has already been applied
- For schema changes in development: use `prisma migrate dev --name description`
- For destructive changes (dropping columns): always create a data migration first
- After adding a new enum value: regenerate the client with `prisma generate`
- Never use `prisma db push` in production

## Error Handling for Prisma

- Catch `PrismaClientKnownRequestError` separately from generic errors
- P2002 = unique constraint violation → return 409 CONFLICT
- P2025 = record not found → return 404 NOT_FOUND
- Never let raw Prisma errors reach the API response

```ts
import { Prisma } from '@prisma/client'

try {
  await prisma.booking.create({ data })
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return Response.json({ error: { code: 'CONFLICT' } }, { status: 409 })
    if (e.code === 'P2025') return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }
  throw e
}
```

## Checklist

- Are all multi-step writes wrapped in a transaction?
- Are N+1 patterns avoided with include or batch queries?
- Is department derived per-request for EMPRESA, not from the user record?
- Are Prisma errors caught and mapped to correct HTTP codes?
- Does the schema use enums for role and status fields?
- Is boat reuse per day allowed (no false uniqueness constraint on date+boatId)?
