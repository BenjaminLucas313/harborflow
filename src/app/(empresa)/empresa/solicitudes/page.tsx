import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listTripRequestsByRequester } from "@/modules/trip-requests/service";
import { Plus, MapPin, Users, Calendar } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING:   "Pendiente",
  FULFILLED: "Completada",
  REJECTED:  "Rechazada",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-blue-100 text-blue-700",
  FULFILLED: "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-red-100 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-600",
};

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

      {requests.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Todavía no enviaste ninguna solicitud.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="rounded-2xl border border-border bg-card p-5 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-4 text-muted-foreground shrink-0" />
                    {req.origin} → {req.destination}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(req.requestedDate).toLocaleString("es-AR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {req.passengerCount} persona{req.passengerCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[req.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[req.status] ?? req.status}
                </span>
              </div>

              {req.status === "REJECTED" && req.rejectionNote && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <span className="font-medium">Motivo del rechazo:</span> {req.rejectionNote}
                </p>
              )}

              {req.status === "FULFILLED" && req.tripId && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  Viaje generado — el proveedor confirmó la asignación de embarcación.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
