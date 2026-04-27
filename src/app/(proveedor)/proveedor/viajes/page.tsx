import { redirect }    from "next/navigation";
import Link            from "next/link";
import { auth }        from "@/lib/auth";
import { prisma }      from "@/lib/prisma";
import { SlotStatus }  from "@prisma/client";
import { Plus }        from "lucide-react";
import { ViajesGrouped }  from "@/components/proveedor/viajes-grouped";
import type { TripItem }  from "@/components/proveedor/viajes-grouped";
import { getPageParam, buildPaginationMeta, PAGE_SIZE } from "@/lib/pagination";

// Statuses that count as an occupied seat.
const ACTIVE_SLOT_STATUSES: SlotStatus[] = ["PENDING", "CONFIRMED"];

export default async function ProveedorViajes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const sp  = await searchParams;
  const now = new Date();

  // 30-day windows keep queries tight and results predictable.
  const thirtyDaysAgo   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { page: pageProximos, skip: skipProximos } = getPageParam(sp, "pageProximos");
  const { page: pagePasados,  skip: skipPasados  } = getPageParam(sp, "pagePasados");

  const upcomingWhere = {
    companyId:     session.user.companyId,
    departureTime: { gte: now, lte: thirtyDaysLater },
  };
  const pastWhere = {
    companyId:     session.user.companyId,
    departureTime: { gte: thirtyDaysAgo, lt: now },
  };

  const tripSelect = {
    id:            true,
    departureTime: true,
    status:        true,
    capacity:      true,
    automatizado:  true,
    boat:          { select: { name: true } },
    branch:        { select: { name: true } },
    driver:        { select: { firstName: true, lastName: true } },
    _count: {
      select: { passengerSlots: { where: { status: { in: ACTIVE_SLOT_STATUSES } } } },
    },
  } as const;

  const [upcomingRaw, upcomingTotal, pastRaw, pastTotal] = await Promise.all([
    prisma.trip.findMany({
      where:   upcomingWhere,
      select:  tripSelect,
      orderBy: { departureTime: "asc" },
      skip:    skipProximos,
      take:    PAGE_SIZE,
    }),
    prisma.trip.count({ where: upcomingWhere }),
    prisma.trip.findMany({
      where:   pastWhere,
      select:  tripSelect,
      orderBy: { departureTime: "desc" },
      skip:    skipPasados,
      take:    PAGE_SIZE,
    }),
    prisma.trip.count({ where: pastWhere }),
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
      conductorName: t.driver
        ? `${t.driver.firstName} ${t.driver.lastName}`
        : undefined,
    };
  }

  const proximos: TripItem[] = upcomingRaw.map(toItem);
  const pasados:  TripItem[] = pastRaw.map(toItem);

  const metaProximos = buildPaginationMeta(upcomingTotal, pageProximos);
  const metaPasados  = buildPaginationMeta(pastTotal,     pagePasados);

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

      <ViajesGrouped
        proximos={proximos}
        pasados={pasados}
        proximosMeta={metaProximos}
        pasadosMeta={metaPasados}
      />
    </main>
  );
}
