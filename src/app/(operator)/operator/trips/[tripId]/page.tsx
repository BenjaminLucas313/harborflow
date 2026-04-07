// Operator trip manifest — /operator/trips/[tripId]
// Shows all passengers booked on a specific trip.

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Ship } from "lucide-react";
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
      capacity: true,
      boat: { select: { name: true } },
    },
  });
  if (!trip) notFound();

  // Fetch reservations for this trip.
  const reservations = await listReservationsByTrip(tripId, companyId);

  // Fetch passenger names — scoped to company to prevent cross-tenant leaks.
  const userIds = reservations.map((r) => r.userId);
  const users =
    userIds.length > 0
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

  // Counts for the header summary.
  const confirmedCount = reservations.filter(
    (r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN",
  ).length;
  const waitlistedCount = reservations.filter(
    (r) => r.status === "WAITLISTED",
  ).length;

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
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      {/* Back link */}
      <Link
        href="/operator/trips"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Back to trips
      </Link>

      {/* Trip header */}
      <div className="flex items-start gap-4 flex-wrap justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Ship className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {trip.boat.name} · {departure}
            </span>
          </div>
        </div>

        {/* Occupancy summary */}
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-medium">
            {confirmedCount} / {trip.capacity} confirmed
          </span>
          {waitlistedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
              {waitlistedCount} waitlisted
            </span>
          )}
        </div>
      </div>

      <Manifest entries={entries} />
    </main>
  );
}
