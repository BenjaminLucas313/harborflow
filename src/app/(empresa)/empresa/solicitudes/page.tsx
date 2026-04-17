import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listTripRequestsByRequester } from "@/modules/trip-requests/service";
import { Plus } from "lucide-react";
import { SolicitudesList } from "@/components/empresa/solicitudes-list";

export default async function MisSolicitudes() {
  const session = await auth();
  if (!session) redirect("/login");

  const allRequests = await listTripRequestsByRequester(
    session.user.companyId,
    session.user.id,
  );

  const now = new Date();

  // Active: requestedDate in the future, ascending by date.
  const activas = allRequests
    .filter((r) => r.requestedDate > now)
    .sort((a, b) => a.requestedDate.getTime() - b.requestedDate.getTime());

  // History: requestedDate in the past or today, descending, capped at 20.
  const historial = allRequests
    .filter((r) => r.requestedDate <= now)
    .sort((a, b) => b.requestedDate.getTime() - a.requestedDate.getTime())
    .slice(0, 20);

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

      {activas.length === 0 && historial.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Todavía no enviaste ninguna solicitud.
        </div>
      )}

      {activas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Activas ({activas.length})
          </h2>
          <SolicitudesList requests={activas} dimmed={false} />
        </section>
      )}

      {historial.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Historial (últimas {historial.length})
          </h2>
          <SolicitudesList requests={historial} dimmed={true} />
        </section>
      )}
    </main>
  );
}
