// Allocation detail — COMPANY_REP views/manages seats and submits to UABL.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findAllocationById } from "@/modules/allocations/repository";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { SeatAllocationActions } from "@/components/allocations/seat-allocation-actions";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT:               { label: "Borrador",              className: "bg-gray-100 text-gray-700" },
  SUBMITTED:           { label: "Enviado a UABL",        className: "bg-blue-100 text-blue-700" },
  PARTIALLY_CONFIRMED: { label: "Parcialmente aprobado", className: "bg-amber-100 text-amber-700" },
  FULLY_CONFIRMED:     { label: "Totalmente aprobado",   className: "bg-emerald-100 text-emerald-700" },
  CANCELLED:           { label: "Cancelado",             className: "bg-red-100 text-red-700" },
};

const SEAT_STATUS: Record<string, { label: string; className: string }> = {
  PENDING:   { label: "Pendiente UABL", className: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmado",     className: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "Rechazado",      className: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelado",      className: "bg-gray-100 text-gray-500" },
};

export default async function AllocationDetailPage({
  params,
}: {
  params: Promise<{ allocationId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { allocationId } = await params;
  const allocation = await findAllocationById(allocationId);

  if (!allocation || allocation.companyId !== session.user.companyId) {
    return (
      <main className="p-8">
        <p className="text-gray-600">Solicitud no encontrada.</p>
      </main>
    );
  }

  const statusInfo = STATUS_LABELS[allocation.status] ?? STATUS_LABELS.DRAFT!;
  const isDraft = allocation.status === "DRAFT";
  const isSubmitted = allocation.status === "SUBMITTED";

  const activeSeats = allocation.seatRequests.filter(
    (s) => s.status !== "CANCELLED",
  );

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/company" className="text-sm text-gray-500 hover:text-gray-700">
            ← Panel
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Solicitud de lugares</h1>
        </div>

        {/* Trip info */}
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(allocation.trip.departureTime).toLocaleString("es-AR", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {allocation.trip.boat.name} · Capacidad total: {allocation.trip.capacity}
              </p>
            </div>
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
          </div>
        </div>

        {/* Seats */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Asientos ({activeSeats.length})
            </h2>
          </div>

          {activeSeats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-gray-500">No hay asientos en esta solicitud.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {activeSeats.map((seat) => {
                const seatStatus = SEAT_STATUS[seat.status] ?? SEAT_STATUS.PENDING!;
                return (
                  <li key={seat.id} className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {seat.employee.firstName} {seat.employee.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {seat.workType.name} · {seat.department.name}
                      </p>
                      {seat.rejectionNote && (
                        <p className="mt-1 text-xs text-red-600">
                          Motivo de rechazo: {seat.rejectionNote}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={seatStatus.className}>{seatStatus.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Actions — client component handles API calls */}
        <SeatAllocationActions
          allocationId={allocationId}
          tripId={allocation.tripId}
          isDraft={isDraft}
          isSubmitted={isSubmitted}
          capacity={allocation.trip.capacity}
          takenSeats={activeSeats.filter((s) => s.status !== "REJECTED").length}
        />

      </div>
    </main>
  );
}
