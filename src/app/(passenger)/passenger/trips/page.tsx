// Passenger trips page — /passenger/trips
// Lists available (non-terminal) trips for the company.
// Each row shows a ReserveButton that reflects whether the passenger
// has already reserved that trip.
//
// Passengers are not scoped to a branch, so trips are queried by companyId.

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { TripStatus, ReservationStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listReservationsByUser } from "@/modules/reservations/service";
import { ReserveButton } from "@/components/reservations/reserve-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reservations.trips");
  return { title: t("metaTitle") };
}

// Non-terminal trip statuses a passenger can browse and book.
const BOOKABLE_STATUSES: TripStatus[] = [
  TripStatus.SCHEDULED,
  TripStatus.BOARDING,
  TripStatus.DELAYED,
];

function formatDateTime(date: Date): string {
  return date.toLocaleString("es", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const TRIP_STATUS_CLASSES: Record<TripStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  BOARDING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  DELAYED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  DEPARTED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
};

export default async function PassengerTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: userId, companyId } = session.user;
  const t = await getTranslations("reservations");
  const tTrips = await getTranslations("trips");

  // Fetch available trips and the passenger's existing reservations in parallel.
  const [trips, reservations] = await Promise.all([
    prisma.trip.findMany({
      where: {
        companyId,
        status: { in: BOOKABLE_STATUSES },
      },
      select: {
        id: true,
        departureTime: true,
        estimatedArrivalTime: true,
        status: true,
        capacity: true,
        waitlistEnabled: true,
        boat: { select: { id: true, name: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { departureTime: "asc" },
    }),
    listReservationsByUser(userId, companyId),
  ]);

  // Build a map of tripId → reservation status so ReserveButton knows
  // whether the passenger already has a reservation for each trip.
  const reservedTrips = new Map<string, ReservationStatus>(
    reservations.map((r) => [r.tripId, r.status]),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("trips.pageTitle")}
      </h1>

      {trips.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          {t("trips.empty")}
        </p>
      ) : (
        <ul className="space-y-3" role="list">
          {trips.map((trip) => {
            const reservationStatus = reservedTrips.get(trip.id) ?? null;
            const tripStatusClass = TRIP_STATUS_CLASSES[trip.status];

            return (
              <li
                key={trip.id}
                className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Trip info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {formatDateTime(trip.departureTime)}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tripStatusClass}`}
                      >
                        {tTrips(`status.${trip.status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {trip.boat.name}
                      {trip.driver && (
                        <>
                          {" · "}
                          {trip.driver.firstName} {trip.driver.lastName}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {trip.capacity} {t("trips.capacity")}
                      {trip.waitlistEnabled && reservationStatus === null && (
                        <> · {t("trips.waitlistAvailable")}</>
                      )}
                    </p>
                  </div>

                  {/* Reserve action */}
                  <ReserveButton
                    tripId={trip.id}
                    reservationStatus={reservationStatus}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
