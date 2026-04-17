import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listTripRequestsByCompany } from "@/modules/trip-requests/service";
import { prisma } from "@/lib/prisma";
import { TripRequestCard } from "@/components/proveedor/trip-request-card";

export default async function ProveedorSolicitudes() {
  const session = await auth();
  if (!session) redirect("/login");

  const all = await listTripRequestsByCompany(session.user.companyId);

  const now = new Date();

  // PENDING with requestedDate in the future → actionable.
  const pending = all
    .filter((r) => r.status === "PENDING" && r.requestedDate > now)
    .sort((a, b) => a.requestedDate.getTime() - b.requestedDate.getTime());

  // PENDING but past requestedDate → expired, no actions allowed.
  const expired = all
    .filter((r) => r.status === "PENDING" && r.requestedDate <= now)
    .sort((a, b) => b.requestedDate.getTime() - a.requestedDate.getTime());

  // Everything non-PENDING (FULFILLED, REJECTED, CANCELLED) → history.
  const resolved = all
    .filter((r) => r.status !== "PENDING")
    .sort((a, b) => b.requestedDate.getTime() - a.requestedDate.getTime());

  // Historial = resolved + expired, capped at 20, most recent first.
  const historial = [...expired.map((r) => ({ ...r, _expired: true })), ...resolved]
    .sort((a, b) => b.requestedDate.getTime() - a.requestedDate.getTime())
    .slice(0, 20);

  const boats = await prisma.boat.findMany({
    where:   { companyId: session.user.companyId, isActive: true },
    select:  { id: true, name: true, capacity: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de lancha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitudes bajo demanda recibidas de empresas.
        </p>
      </div>

      {pending.length === 0 && historial.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No hay solicitudes registradas.
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pendientes ({pending.length})
          </h2>
          {pending.map((req) => (
            <TripRequestCard key={req.id} request={req as never} boats={boats} expired={false} />
          ))}
        </section>
      )}

      {historial.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historial ({historial.length})
          </h2>
          {historial.map((req) => (
            <TripRequestCard
              key={req.id}
              request={req as never}
              boats={boats}
              expired={"_expired" in req && req._expired === true}
            />
          ))}
        </section>
      )}
    </main>
  );
}
