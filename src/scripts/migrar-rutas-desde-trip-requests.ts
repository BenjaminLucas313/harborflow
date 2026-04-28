/**
 * Data migration: copy origin/destination from TripRequest into TripStop records.
 *
 * For every Trip linked to a TripRequest with non-null origin and destination,
 * creates 2 TripStop rows (order 0 = origin, order 1 = destination) — but only
 * if the Trip has no stops yet (idempotent).
 *
 * Run: npm run trips:migrar-rutas
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Only trips that have a linked TripRequest and no stops yet.
  const trips = await prisma.trip.findMany({
    where: {
      tripRequest: { isNot: null },
      stops:       { none: {} },
    },
    select: {
      id:          true,
      tripRequest: { select: { origin: true, destination: true } },
    },
  });

  const eligible = trips.filter(
    (t) => t.tripRequest?.origin && t.tripRequest?.destination,
  );

  if (eligible.length === 0) {
    console.log("No hay viajes elegibles para migrar (todos tienen stops o no tienen TripRequest con ruta).");
    return;
  }

  console.log(`Migrando rutas para ${eligible.length} viaje(s)…`);

  let migrated = 0;
  for (const trip of eligible) {
    const origin      = trip.tripRequest!.origin!;
    const destination = trip.tripRequest!.destination!;

    await prisma.tripStop.createMany({
      data: [
        { tripId: trip.id, order: 0, name: origin },
        { tripId: trip.id, order: 1, name: destination },
      ],
    });

    console.log(`  ✓ ${trip.id}: ${origin} → ${destination}`);
    migrated++;
  }

  console.log(`\nMigración completada: ${migrated} viaje(s) actualizados.`);
}

main()
  .catch((err) => {
    console.error("Error en migración:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
