// /empresa/reservas/nueva — server component that fetches trips, renders client form.
// Trips are fetched server-side (no client API call) to avoid branchId param issues.

import { redirect }            from "next/navigation";
import { auth }                from "@/lib/auth";
import { prisma }              from "@/lib/prisma";
import { NuevaReservaForm }    from "@/components/empresa/nueva-reserva-form";

export default async function NuevaReserva({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tripId: presetTripId = "" } = await searchParams;

  // Fetch upcoming bookable trips for this company — same pattern as empresa/viajes/page.tsx.
  const trips = await prisma.trip.findMany({
    where: {
      companyId:     session.user.companyId,
      status:        { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
      departureTime: { gte: new Date() },
    },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
    },
    orderBy: { departureTime: "asc" },
    take:    50,
  });

  // Serialize Date objects — client components receive plain strings via RSC boundary.
  const serialized = trips.map((t) => ({ ...t, departureTime: t.departureTime.toISOString() }));

  return <NuevaReservaForm trips={serialized} presetTripId={presetTripId} />;
}
