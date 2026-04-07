// Passenger dashboard at /passenger.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Ship, BookOpen } from "lucide-react";

import { auth } from "@/lib/auth";

export default async function PassengerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName } = session.user;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What would you like to do today?
        </p>
      </div>

      {/* Navigation cards */}
      <nav aria-label="Secciones" className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/passenger/trips"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <Ship className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Viajes disponibles</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Browse upcoming departures and book your seat.
          </p>
        </Link>

        <Link
          href="/passenger/reservations"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Mis reservas</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            View your active reservations and waitlist positions.
          </p>
        </Link>
      </nav>
    </main>
  );
}
