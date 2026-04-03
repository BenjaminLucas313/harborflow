// Passenger dashboard at /passenger.
// Active reservation, upcoming trips, waitlist entries.

import Link from "next/link";

export default function PassengerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Panel de pasajero</h1>
      <nav className="mt-6">
        <ul className="space-y-2">
          <li>
            <Link
              href="/passenger/trips"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Viajes disponibles →
            </Link>
          </li>
          <li>
            <Link
              href="/passenger/reservations"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Mis reservas →
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
