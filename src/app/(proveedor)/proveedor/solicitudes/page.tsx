import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listTripRequestsByCompany } from "@/modules/trip-requests/service";
import { prisma } from "@/lib/prisma";
import { TripRequestCard } from "@/components/proveedor/trip-request-card";

export default async function ProveedorSolicitudes() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch PENDING requests first, then others.
  const [pending, others] = await Promise.all([
    listTripRequestsByCompany(session.user.companyId, "PENDING"),
    listTripRequestsByCompany(session.user.companyId).then((all) =>
      all.filter((r) => r.status !== "PENDING"),
    ),
  ]);

  const requests = [...pending, ...others];

  // Fetch boats for the accept form.
  const boats = await prisma.boat.findMany({
    where:   { companyId: session.user.companyId, isActive: true },
    select:  { id: true, name: true, capacity: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de lancha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitudes bajo demanda recibidas de empresas.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pendientes ({pending.length})
          </h2>
          {pending.map((req) => (
            <TripRequestCard key={req.id} request={req as never} boats={boats} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historial
          </h2>
          {others.map((req) => (
            <TripRequestCard key={req.id} request={req as never} boats={boats} />
          ))}
        </div>
      )}

      {requests.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No hay solicitudes registradas.
        </div>
      )}
    </main>
  );
}
