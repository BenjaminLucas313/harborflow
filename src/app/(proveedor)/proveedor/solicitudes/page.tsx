import { Suspense }  from "react";
import { redirect }  from "next/navigation";
import { auth }      from "@/lib/auth";
import { prisma }    from "@/lib/prisma";
import { TripRequestCard } from "@/components/proveedor/trip-request-card";
import { getPageParam, buildPaginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import {
  listPendingByCompanyPaginated,
  listHistorialByCompanyPaginated,
} from "@/modules/trip-requests/repository";

export default async function ProveedorSolicitudes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const sp = await searchParams;

  const { page: pageActivas,   skip: skipActivas   } = getPageParam(sp, "pageActivas");
  const { page: pageHistorial, skip: skipHistorial } = getPageParam(sp, "pageHistorial");

  const [pendingResult, historialResult, boats] = await Promise.all([
    listPendingByCompanyPaginated(session.user.companyId, skipActivas, 20),
    listHistorialByCompanyPaginated(session.user.companyId, skipHistorial, 20),
    prisma.boat.findMany({
      where:   { companyId: session.user.companyId, isActive: true },
      select:  { id: true, name: true, capacity: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const metaActivas   = buildPaginationMeta(pendingResult.total,   pageActivas);
  const metaHistorial = buildPaginationMeta(historialResult.total, pageHistorial);

  const isEmpty = pendingResult.total === 0 && historialResult.total === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de lancha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitudes bajo demanda recibidas de empresas.
        </p>
      </div>

      {isEmpty && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No hay solicitudes registradas.
        </div>
      )}

      {/* Pendientes (PENDING + requestedDate > now) */}
      {(pendingResult.data.length > 0 || pageActivas > 1) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pendientes ({pendingResult.total})
          </h2>
          {pendingResult.data.map((req) => (
            <TripRequestCard key={req.id} request={req as never} boats={boats} expired={false} />
          ))}
          <Suspense fallback={null}>
            <Pagination
              page={pageActivas}
              totalPages={metaActivas.totalPages}
              total={pendingResult.total}
              paramName="pageActivas"
            />
          </Suspense>
        </section>
      )}

      {/* Historial (resolved + expired PENDING) */}
      {(historialResult.data.length > 0 || pageHistorial > 1) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historial ({historialResult.total})
          </h2>
          {historialResult.data.map((req) => (
            <TripRequestCard
              key={req.id}
              request={req as never}
              boats={boats}
              expired={req.status === "PENDING"}
            />
          ))}
          <Suspense fallback={null}>
            <Pagination
              page={pageHistorial}
              totalPages={metaHistorial.totalPages}
              total={historialResult.total}
              paramName="pageHistorial"
            />
          </Suspense>
        </section>
      )}
    </main>
  );
}
