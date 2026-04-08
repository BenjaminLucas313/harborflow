// Provider dashboard — fleet summary and port status.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ProviderDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId } = session.user;

  const [boats, upcomingTrips, portStatus] = await Promise.all([
    prisma.boat.count({ where: { companyId, isActive: true } }),
    prisma.trip.count({
      where: {
        companyId,
        status: { in: ["SCHEDULED", "BOARDING", "DELAYED"] },
        departureTime: { gte: new Date() },
      },
    }),
    prisma.portStatus.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { status: true, message: true, estimatedReopeningAt: true, createdAt: true },
    }),
  ]);

  const isPortOpen = !portStatus || portStatus.status === "OPEN";

  const PORT_STATUS_LABELS: Record<string, string> = {
    OPEN:                "Abierto",
    PARTIALLY_OPEN:      "Parcialmente abierto",
    CLOSED_WEATHER:      "Cerrado — Clima",
    CLOSED_MAINTENANCE:  "Cerrado — Mantenimiento",
    CLOSED_SECURITY:     "Cerrado — Seguridad",
    CLOSED_OTHER:        "Cerrado — Otro motivo",
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel del Proveedor</h1>
          <p className="mt-1 text-sm text-gray-500">
            {session.user.firstName} {session.user.lastName}
          </p>
        </div>

        {/* Port status banner */}
        <div className={`rounded-xl border p-5 ${
          isPortOpen
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={`font-semibold ${isPortOpen ? "text-emerald-800" : "text-red-800"}`}>
                Puerto: {portStatus ? PORT_STATUS_LABELS[portStatus.status] ?? portStatus.status : "Abierto"}
              </p>
              {portStatus?.message && (
                <p className="mt-0.5 text-sm text-gray-600">{portStatus.message}</p>
              )}
              {portStatus?.estimatedReopeningAt && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Reapertura estimada:{" "}
                  {new Date(portStatus.estimatedReopeningAt).toLocaleString("es-AR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
            <Link
              href="/provider/port"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0"
            >
              Cambiar estado
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white p-5 text-center">
            <p className="text-4xl font-bold text-gray-900">{boats}</p>
            <p className="mt-1 text-sm text-gray-500">Embarcaciones activas</p>
          </div>
          <div className="rounded-xl border bg-white p-5 text-center">
            <p className="text-4xl font-bold text-blue-700">{upcomingTrips}</p>
            <p className="mt-1 text-sm text-gray-500">Viajes programados</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            { href: "/provider/vessels", label: "Embarcaciones", icon: "🚢" },
            { href: "/provider/trips", label: "Horarios", icon: "🗓️" },
            { href: "/provider/port", label: "Estado del puerto", icon: "⚓" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center rounded-xl border bg-white p-5 text-center hover:border-blue-300 transition-colors"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="mt-2 text-sm font-medium text-gray-700">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}
