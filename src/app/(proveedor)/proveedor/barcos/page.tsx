import { redirect } from "next/navigation";
import { auth }     from "@/lib/auth";
import { prisma }   from "@/lib/prisma";
import { Users, Plus } from "lucide-react";
import Link from "next/link";

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Barcos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Flota registrada en el sistema.</p>
        </div>
        <Link
          href="/proveedor/barcos/nueva"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="size-4" />
          Nueva embarcación
        </Link>
      </div>

      {boats.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No hay barcos registrados todavía.</p>
          <Link
            href="/proveedor/barcos/nueva"
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Plus className="size-4" />
            Agregar el primero
          </Link>
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
