// Passenger dashboard at /passenger.

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function PassengerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName, lastName, companyId } = session.user;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bienvenido, {firstName} {lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empresa: {company?.name ?? "Unknown company"}
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Navigation */}
      <nav aria-label="Secciones">
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
