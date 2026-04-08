import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Programado",
  BOARDING:  "Embarcando",
  DELAYED:   "Demorado",
  CANCELLED: "Cancelado",
  DEPARTED:  "Partido",
  COMPLETED: "Completado",
};
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  BOARDING:  "bg-amber-100 text-amber-700",
  DELAYED:   "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-600",
  DEPARTED:  "bg-slate-100 text-slate-600",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

export default async function ProveedorViajes() {
  const session = await auth();
  if (!session) redirect("/login");

  const trips = await prisma.trip.findMany({
    where:   { companyId: session.user.companyId },
    select:  {
      id:            true,
      departureTime: true,
      status:        true,
      capacity:      true,
      boat:          { select: { name: true } },
      branch:        { select: { name: true } },
      passengerSlots: {
        where:  { status: { in: ["PENDING", "CONFIRMED"] } },
        select: { id: true },
      },
    },
    orderBy: { departureTime: "desc" },
    take:    50,
  });

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

      {trips.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No hay viajes registrados.
        </div>
      ) : (
        <ul className="space-y-2">
          {trips.map((trip) => {
            const dep = new Date(trip.departureTime).toLocaleString("es-AR", {
              timeZone: "America/Argentina/Buenos_Aires",
              weekday:  "short",
              day:      "numeric",
              month:    "short",
              year:     "numeric",
              hour:     "2-digit",
              minute:   "2-digit",
            });
            return (
              <li key={trip.id}>
                <Link
                  href={`/proveedor/viajes/${trip.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-sm transition-shadow"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{trip.boat.name}</p>
                    <p className="text-xs text-muted-foreground">{dep} · {trip.branch.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {trip.passengerSlots.length}/{trip.capacity}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[trip.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[trip.status] ?? trip.status}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
