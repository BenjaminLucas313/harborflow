import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listTripRequestsByRequester } from "@/modules/trip-requests/service";
import { Plus } from "lucide-react";
import { SolicitudesList } from "@/components/empresa/solicitudes-list";

export default async function MisSolicitudes() {
  const session = await auth();
  if (!session) redirect("/login");

  const requests = await listTripRequestsByRequester(
    session.user.companyId,
    session.user.id,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
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

      <SolicitudesList requests={requests} />
    </main>
  );
}
