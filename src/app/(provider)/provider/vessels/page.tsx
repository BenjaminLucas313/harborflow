// Provider vessel management — CRUD de embarcaciones.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ProviderVesselsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const boats = await prisma.boat.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      capacity: true,
      description: true,
      isActive: true,
      branch: { select: { name: true } },
      _count: { select: { trips: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/provider" className="text-sm text-gray-500 hover:text-gray-700">
              ← Panel
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Embarcaciones</h1>
          </div>
        </div>

        {boats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">No hay embarcaciones registradas.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {boats.map((boat) => (
              <li key={boat.id} className={`rounded-xl border bg-white p-4 ${!boat.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{boat.name}</p>
                      {!boat.isActive && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactiva</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600">
                      Capacidad: {boat.capacity} lugares · {boat.branch.name}
                    </p>
                    {boat.description && (
                      <p className="mt-0.5 text-xs text-gray-400">{boat.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {boat._count.trips} viaje{boat._count.trips !== 1 ? "s" : ""} programado{boat._count.trips !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-400 text-center">
          Para crear o editar embarcaciones, usá la interfaz de administración de base de datos hasta que el formulario esté disponible.
        </p>

      </div>
    </main>
  );
}
