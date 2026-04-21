import { redirect }    from "next/navigation";
import Link            from "next/link";
import { auth }        from "@/lib/auth";
import { prisma }      from "@/lib/prisma";
import { SlotStatus }  from "@prisma/client";
import { Plus }        from "lucide-react";
import { ViajesGrouped }  from "@/components/proveedor/viajes-grouped";
import type { TripItem }  from "@/components/proveedor/viajes-grouped";

// Statuses that count as an occupied seat.
const ACTIVE_SLOT_STATUSES: SlotStatus[] = ["PENDING", "CONFIRMED"];

export default async function ProveedorViajes() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  // 30-day windows keep queries tight and results predictable.
  // Both are covered by @@index([companyId, departureTime]).
  const thirtyDaysAgo   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Run both queries in parallel — independent result sets.
  // _count with a filtered relation (Prisma ≥ 4.3) runs a COUNT aggregate
  // instead of fetching every slot ID row — the main previous bottleneck.
  const [upcomingRaw, pastRaw] = await Promise.all([
    // Upcoming: next 30 days, nearest first, max 50.
    prisma.trip.findMany({
      where: {
        companyId:     session.user.companyId,
        departureTime: { gte: now, lte: thirtyDaysLater },
      },
      select: {
        id:            true,
        departureTime: true,
        status:        true,
        capacity:      true,
        automatizado:  true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        _count: {
          select: { passengerSlots: { where: { status: { in: ACTIVE_SLOT_STATUSES } } } },
        },
      },
      orderBy: { departureTime: "asc" },
      take:    50,
    }),
    // Past: last 30 days, most recent first, max 30.
    prisma.trip.findMany({
      where: {
        companyId:     session.user.companyId,
        departureTime: { gte: thirtyDaysAgo, lt: now },
      },
      select: {
        id:            true,
        departureTime: true,
        status:        true,
        capacity:      true,
        automatizado:  true,
        boat:          { select: { name: true } },
        branch:        { select: { name: true } },
        _count: {
          select: { passengerSlots: { where: { status: { in: ACTIVE_SLOT_STATUSES } } } },
        },
      },
      orderBy: { departureTime: "desc" },
      take:    30,
    }),
  ]);

  function toItem(t: typeof upcomingRaw[number]): TripItem {
    return {
      id:            t.id,
      departureTime: t.departureTime,
      status:        t.status,
      capacity:      t.capacity,
      occupancy:     t._count.passengerSlots,
      boatName:      t.boat.name,
      branchName:    t.branch.name,
      automatizado:  t.automatizado,
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
