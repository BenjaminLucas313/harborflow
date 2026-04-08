import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Users } from "lucide-react";

export default async function ProveedorBarcos() {
  const session = await auth();
  if (!session) redirect("/login");

  const boats = await prisma.boat.findMany({
    where:   { companyId: session.user.companyId, isActive: true },
    select:  { id: true, name: true, capacity: true, description: true, branch: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Barcos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Flota registrada en el sistema.
        </p>
      </div>

      {boats.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No hay barcos registrados. Contactá al administrador para agregar embarcaciones.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {boats.map((boat) => (
            <li key={boat.id} className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <p className="font-semibold">{boat.name}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4" />
                Capacidad: {boat.capacity} pasajeros
              </div>
              {boat.description && (
                <p className="text-xs text-muted-foreground">{boat.description}</p>
              )}
              <p className="text-xs text-muted-foreground">Puerto: {boat.branch.name}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
