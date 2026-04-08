// Provider port status management — open/close port with reason.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PortStatusForm } from "@/components/provider/port-status-form";

const STATUS_LABELS: Record<string, string> = {
  OPEN:               "Abierto",
  PARTIALLY_OPEN:     "Parcialmente abierto",
  CLOSED_WEATHER:     "Cerrado — Clima",
  CLOSED_MAINTENANCE: "Cerrado — Mantenimiento",
  CLOSED_SECURITY:    "Cerrado — Seguridad",
  CLOSED_OTHER:       "Cerrado — Otro motivo",
};

export default async function ProviderPortPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId } = session.user;

  // Fetch the branch for this provider (uses branchId from session if available).
  const branch = await prisma.branch.findFirst({
    where: { companyId },
    select: { id: true, name: true },
  });

  if (!branch) {
    return (
      <main className="p-8">
        <p className="text-gray-600">No hay una sede registrada para este proveedor.</p>
      </main>
    );
  }

  const currentStatus = await prisma.portStatus.findFirst({
    where: { companyId, branchId: branch.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, message: true, estimatedReopeningAt: true, createdAt: true },
  });

  // Last 10 status changes
  const history = await prisma.portStatus.findMany({
    where: { companyId, branchId: branch.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      setByUser: { select: { firstName: true, lastName: true } },
    },
  });

  const isOpen = !currentStatus || currentStatus.status === "OPEN";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">

        <div className="flex items-center gap-4">
          <Link href="/provider" className="text-sm text-gray-500 hover:text-gray-700">
            ← Panel
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Estado del puerto</h1>
        </div>

        {/* Current status */}
        <div className={`rounded-xl border p-5 ${
          isOpen ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
        }`}>
          <p className={`text-xl font-bold ${isOpen ? "text-emerald-800" : "text-red-800"}`}>
            {currentStatus
              ? STATUS_LABELS[currentStatus.status] ?? currentStatus.status
              : "Abierto"}
          </p>
          {currentStatus?.message && (
            <p className="mt-1 text-sm text-gray-700">{currentStatus.message}</p>
          )}
          {currentStatus?.estimatedReopeningAt && (
            <p className="mt-1 text-xs text-gray-500">
              Reapertura estimada:{" "}
              {new Date(currentStatus.estimatedReopeningAt).toLocaleString("es-AR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Puerto: {branch.name}
          </p>
        </div>

        {/* Change status form */}
        <PortStatusForm
          branchId={branch.id}
          companyId={companyId}
          currentStatus={currentStatus?.status ?? "OPEN"}
        />

        {/* History */}
        {history.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Historial reciente
            </h2>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-4 rounded-lg border bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {STATUS_LABELS[h.status] ?? h.status}
                    </p>
                    {h.message && (
                      <p className="text-xs text-gray-500">{h.message}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {h.setByUser.firstName} {h.setByUser.lastName}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-400">
                    {new Date(h.createdAt).toLocaleString("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </main>
  );
}
