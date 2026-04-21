import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTripForm } from "@/components/proveedor/new-trip-form";

export default async function NuevoViaje() {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId } = session.user;

  const [boats, drivers, branches] = await Promise.all([
    prisma.boat.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true, capacity: true },
      orderBy: { name: "asc" },
    }),
    prisma.driver.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.branch.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo viaje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Programá una nueva salida para tu flota.
        </p>
      </div>
      <NewTripForm boats={boats} drivers={drivers} branches={branches} />
    </main>
  );
}
