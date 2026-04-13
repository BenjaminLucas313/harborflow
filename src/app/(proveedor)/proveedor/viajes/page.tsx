import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";
import { ViajesGrouped } from "@/components/proveedor/viajes-grouped";
import type { TripItem } from "@/components/proveedor/viajes-grouped";

export default async function ProveedorViajes() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();

  // Fetch upcoming trips — nearest first.
  const upcomingRaw = await prisma.trip.findMany({
    where: {
      companyId:     session.user.companyId,
      departureTime: { gte: now },
    },
    select: {
      id:             true,
      departureTime:  true,
      status:         true,
      capacity:       true,
      boat:           { select: { name: true } },
      branch:         { select: { name: true } },
      passengerSlots: {
        where:  { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true },
      },
    },
    orderBy: { departureTime: "asc" },
    take: 50,
  });

  // Fetch past trips — most recent first.
  const pastRaw = await prisma.trip.findMany({
    where: {
      companyId:     session.user.companyId,
      departureTime: { lt: now },
    },
    select: {
      id:             true,
      departureTime:  true,
      status:         true,
      capacity:       true,
      boat:           { select: { name: true } },
      branch:         { select: { name: true } },
      passengerSlots: {
        where:  { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true },
      },
    },
    orderBy: { departureTime: "desc" },
    take: 30,
  });

  function toItem(t: typeof upcomingRaw[number]): TripItem {
    return {
      id:            t.id,
      departureTime: t.departureTime,
      status:        t.status,
      capacity:      t.capacity,
      occupancy:     t.passengerSlots.length,
      boatName:      t.boat.name,
      branchName:    t.branch.name,
    };
  }

  const proximos: TripItem[] = upcomingRaw.map(toItem);
  const pasados:  TripItem[] = pastRaw.map(toItem);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Viajes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Todos los viajes programados.</p>
        </div>
        <Link
          href="/proveedor/viajes/nuevo"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="size-4" />
          Nuevo viaje
        </Link>
      </div>

      <ViajesGrouped proximos={proximos} pasados={pasados} />
    </main>
  );
}
