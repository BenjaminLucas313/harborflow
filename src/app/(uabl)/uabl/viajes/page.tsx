import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Color coding for the seat grid cells.
const SLOT_COLORS = {
  PENDING:   "bg-blue-400",
  CONFIRMED: "bg-emerald-500",
  REJECTED:  "bg-red-400",
  CANCELLED: "bg-slate-200",
} as const;

export default async function UablViajes() {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId, departmentId } = session.user;

  // Fetch upcoming trips with their slot summaries for this department.
  const trips = await prisma.trip.findMany({
    where: {
      companyId,
      status: { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
      departureTime: { gte: new Date() },
    },
    select: {
      id:            true,
      departureTime: true,
      capacity:      true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
      passengerSlots: {
        where: departmentId ? { departmentId } : {},
        select: { id: true, status: true },
      },
    },
    orderBy: { departureTime: "asc" },
    take: 20,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Viajes programados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hacé clic en un viaje para ver y revisar los slots pendientes.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(SLOT_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-sm ${color}`} />
            {status === "PENDING"   && "Pendiente"}
            {status === "CONFIRMED" && "Confirmado"}
            {status === "REJECTED"  && "Rechazado"}
            {status === "CANCELLED" && "Cancelado"}
          </div>
        ))}
      </div>

      {trips.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No hay viajes programados próximamente.
        </div>
      ) : (
        <ul className="space-y-4">
          {trips.map((trip) => {
            const slots   = trip.passengerSlots;
            const pending = slots.filter((s) => s.status === "PENDING").length;

            const departure = new Date(trip.departureTime).toLocaleString("es-AR", {
              timeZone: "America/Argentina/Buenos_Aires",
              weekday:  "short",
              day:      "numeric",
              month:    "short",
              hour:     "2-digit",
              minute:   "2-digit",
            });

            return (
              <li key={trip.id}>
                <Link
                  href={`/uabl/viajes/${trip.id}`}
                  className="block rounded-2xl border border-border bg-card p-5 hover:shadow-md transition-shadow space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{trip.boat.name}</p>
                      <p className="text-sm text-muted-foreground">{departure} · {trip.branch.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-muted-foreground">
                        {slots.length} / {trip.capacity} slots
                      </p>
                      {pending > 0 && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {pending} pendiente{pending > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mini seat grid */}
                  {slots.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {slots.map((s) => (
                        <span
                          key={s.id}
                          className={`size-4 rounded-sm ${SLOT_COLORS[s.status as keyof typeof SLOT_COLORS] ?? "bg-slate-200"}`}
                          title={s.status}
                        />
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
