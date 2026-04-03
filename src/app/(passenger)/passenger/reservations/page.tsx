// Passenger reservations page — /passenger/reservations
// Shows the passenger's own active reservations, including waitlist position
// for any WAITLISTED entries.

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { WaitlistStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listReservationsByUser } from "@/modules/reservations/service";
import { ReservationList, type WaitlistInfo } from "@/components/reservations/reservation-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reservations.myReservations");
  return { title: t("metaTitle") };
}

export default async function PassengerReservationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: userId, companyId } = session.user;
  const t = await getTranslations("reservations.myReservations");

  const reservations = await listReservationsByUser(userId, companyId);

  // Fetch waitlist positions for any WAITLISTED reservations so the list
  // can display "Position #N on waitlist".
  const waitlistedTripIds = reservations
    .filter((r) => r.status === "WAITLISTED")
    .map((r) => r.tripId);

  // Fetch waitlist entries with both id (for cancellation) and position (for display).
  const waitlistEntries = new Map<string, WaitlistInfo>();

  if (waitlistedTripIds.length > 0) {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        tripId: { in: waitlistedTripIds },
        userId,
        status: WaitlistStatus.WAITING,
      },
      select: { id: true, tripId: true, position: true },
    });
    for (const entry of entries) {
      waitlistEntries.set(entry.tripId, { id: entry.id, position: entry.position });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
      <ReservationList
        reservations={reservations}
        waitlistEntries={waitlistEntries}
      />
    </main>
  );
}
