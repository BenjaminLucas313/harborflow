import { Suspense }  from "react";
import { redirect }  from "next/navigation";
import Link          from "next/link";
import { auth }      from "@/lib/auth";
import { Plus }      from "lucide-react";
import { getPageParam, buildPaginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { SolicitudesList } from "@/components/empresa/solicitudes-list";
import {
  listActivasByRequesterPaginated,
  listHistorialByRequesterPaginated,
} from "@/modules/trip-requests/repository";

export default async function MisSolicitudes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const sp = await searchParams;

  const { page: pageActivas,   skip: skipActivas   } = getPageParam(sp, "pageActivas");
  const { page: pageHistorial, skip: skipHistorial } = getPageParam(sp, "pageHistorial");

  const [activasResult, historialResult] = await Promise.all([
    listActivasByRequesterPaginated(
      session.user.companyId,
      session.user.id,
      skipActivas,
      20,
    ),
    listHistorialByRequesterPaginated(
      session.user.companyId,
      session.user.id,
      skipHistorial,
      20,
    ),
  ]);

  const metaActivas   = buildPaginationMeta(activasResult.total,   pageActivas);
  const metaHistorial = buildPaginationMeta(historialResult.total, pageHistorial);

  const isEmpty = activasResult.total === 0 && historialResult.total === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de lancha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitudes bajo demanda enviadas al proveedor.
          </p>
        </div>
        <Link
          href="/empresa/solicitudes/nueva"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="size-4" />
          Nueva solicitud
        </Link>
      </div>

      {isEmpty && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Todavía no enviaste ninguna solicitud.
        </div>
      )}

      {/* Activas */}
      {(activasResult.data.length > 0 || pageActivas > 1) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Activas ({activasResult.total})
          </h2>
          <SolicitudesList requests={activasResult.data} dimmed={false} />
          <Suspense fallback={null}>
            <Pagination
              page={pageActivas}
              totalPages={metaActivas.totalPages}
              total={activasResult.total}
              paramName="pageActivas"
            />
          </Suspense>
        </section>
      )}

      {/* Historial */}
      {(historialResult.data.length > 0 || pageHistorial > 1) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historial ({historialResult.total})
          </h2>
          <SolicitudesList requests={historialResult.data} dimmed={true} />
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
