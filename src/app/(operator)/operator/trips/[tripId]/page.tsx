// Operator trip manifest — /operator/trips/[tripId]
// Shows all passengers booked on a specific trip with their names,
// reservation status, and waitlist position where applicable.
// Accessible to OPERATOR and ADMIN (operator layout enforces this).

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { WaitlistStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listReservationsByTrip } from "@/modules/reservations/service";
import { Manifest, type ManifestEntry } from "@/components/reservations/manifest";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reservations.manifest");
  return { title: t("metaTitle") };
}

type PageProps = { params: Promise<{ tripId: string }> };

export default async function TripManifestPage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tripId } = await params;
  const { companyId } = session.user;
  const t = await getTranslations("reservations.manifest");

  // Validate the trip exists and belongs to this company.
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, companyId },
    select: {
      id: true,
      departureTime: true,
      boat: { select: { name: true } },
    },
  });
  if (!trip) notFound();

  // Fetch reservations for this trip.
  const reservations = await listReservationsByTrip(tripId, companyId);

  // Fetch passenger names — scoped to company to prevent cross-tenant leaks.
  const userIds = reservations.map((r) => r.userId);
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, companyId },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];

  const nameByUserId = new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
  );

  // Fetch waitlist positions for any WAITLISTED reservations.
  const waitlistedUserIds = reservations
    .filter((r) => r.status === "WAITLISTED")
    .map((r) => r.userId);

  const positionByUserId = new Map<string, number>();
  if (waitlistedUserIds.length > 0) {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        tripId,
        userId: { in: waitlistedUserIds },
        status: WaitlistStatus.WAITING,
      },
      select: { userId: true, position: true },
    });
    for (const e of entries) {
      positionByUserId.set(e.userId, e.position);
    }
  }

  // Build manifest entries.
  const entries: ManifestEntry[] = reservations.map((r) => ({
    ...r,
    passengerName: nameByUserId.get(r.userId) ?? r.userId,
    waitlistPosition: positionByUserId.get(r.userId),
  }));

  // Format the departure time for the heading.
  const departure = trip.departureTime.toLocaleString("es", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {trip.boat.name} · {departure}
        </p>
      </div>

      <Manifest entries={entries} />
    </main>
  );
}
