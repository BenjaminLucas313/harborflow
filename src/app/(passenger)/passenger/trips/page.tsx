// Passenger trips page — /passenger/trips
// Lists available (non-terminal) trips for the company.
// Each card shows departure time, vessel, driver, seat availability, and a
// context-aware action (Reserve / Join waitlist / Full).

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { TripStatus, ReservationStatus, WaitlistStatus } from "@prisma/client";

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

function formatDate(date: Date): string {
  return date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const TRIP_STATUS_BADGE: Record<TripStatus, string> = {
  SCHEDULED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  BOARDING:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  DELAYED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CANCELLED:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  DEPARTED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
};

// Thin coloured strip at the top of each card, keyed by trip status.
const STATUS_STRIPE: Record<TripStatus, string> = {
  SCHEDULED: "bg-blue-500",
  BOARDING: "bg-emerald-500",
  DELAYED: "bg-amber-500",
  CANCELLED: "bg-red-400",
  DEPARTED: "bg-slate-300 dark:bg-slate-600",
  COMPLETED: "bg-slate-300 dark:bg-slate-600",
};

export default async function PassengerTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: userId, companyId } = session.user;
  const t = await getTranslations("reservations");
  const tTrips = await getTranslations("trips");

  // Phase 1: trips + existing reservations in parallel.
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

  // Phase 2: seat counts + waitlist positions (depend on phase-1 results).
  const tripIds = trips.map((trip) => trip.id);
  const waitlistedTripIds = reservations
    .filter((r) => r.status === "WAITLISTED")
    .map((r) => r.tripId);

  const [seatCountRows, waitlistPositionEntries] = await Promise.all([
    tripIds.length > 0
      ? prisma.reservation.groupBy({
          by: ["tripId"],
          where: {
            tripId: { in: tripIds },
            status: { in: ["CONFIRMED", "CHECKED_IN"] },
            companyId,
          },
          _count: { id: true },
        })
      : Promise.resolve([]),
    waitlistedTripIds.length > 0
      ? prisma.waitlistEntry.findMany({
          where: {
            tripId: { in: waitlistedTripIds },
            userId,
            status: WaitlistStatus.WAITING,
          },
          select: { tripId: true, position: true },
        })
      : Promise.resolve([]),
  ]);

  // Build lookup maps.
  const reservedTrips = new Map<string, ReservationStatus>(
    reservations.map((r) => [r.tripId, r.status]),
  );
  const seatCountMap = new Map(
    seatCountRows.map((r) => [r.tripId, r._count.id]),
  );
  const waitlistPositionMap = new Map(
    waitlistPositionEntries.map((e) => [e.tripId, e.position]),
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
        <ul className="space-y-4" role="list">
          {trips.map((trip) => {
            const reservationStatus = reservedTrips.get(trip.id) ?? null;
            const confirmedSeats = seatCountMap.get(trip.id) ?? 0;
            const isFull = confirmedSeats >= trip.capacity;
            const waitlistPosition = waitlistPositionMap.get(trip.id) ?? null;

            // Highlight the card border when full and the passenger hasn't booked.
            const cardBorder =
              isFull && reservationStatus === null
                ? "border-red-200 dark:border-red-900/40"
                : "border-border";

            return (
              <li
                key={trip.id}
                className={`rounded-xl border bg-card shadow-sm overflow-hidden ${cardBorder}`}
              >
                {/* Coloured top strip indicating trip status */}
                <div
                  className={`h-1 ${STATUS_STRIPE[trip.status]}`}
                  aria-hidden="true"
                />

                <div className="px-5 py-4 space-y-3">
                  {/* Row 1: date (left) + trip status badge (right) */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground capitalize">
                      {formatDate(trip.departureTime)}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${TRIP_STATUS_BADGE[trip.status]}`}
                    >
                      {tTrips(`status.${trip.status}`)}
                    </span>
                  </div>

                  {/* Row 2: departure time + estimated arrival */}
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {formatTime(trip.departureTime)}
                    {trip.estimatedArrivalTime && (
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        <span className="text-sm">→</span>{" "}
                        {formatTime(trip.estimatedArrivalTime)}
                      </span>
                    )}
                  </p>

                  {/* Row 3: vessel + driver */}
                  <p className="text-sm text-muted-foreground">
                    {trip.boat.name}
                    {trip.driver && (
                      <>
                        {" · "}
                        {trip.driver.firstName} {trip.driver.lastName}
                      </>
                    )}
                  </p>

                  {/* Row 4: seat count + action */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="space-y-0.5">
                      <p
                        className={`text-sm font-medium ${
                          isFull
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {confirmedSeats} / {trip.capacity}{" "}
                        {t("trips.capacity")}
                      </p>
                      {isFull &&
                        trip.waitlistEnabled &&
                        reservationStatus === null && (
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            {t("trips.waitlistAvailable")}
                          </p>
                        )}
                    </div>

                    <ReserveButton
                      tripId={trip.id}
                      reservationStatus={reservationStatus}
                      waitlistPosition={waitlistPosition}
                      isFull={isFull}
                      waitlistEnabled={trip.waitlistEnabled}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
