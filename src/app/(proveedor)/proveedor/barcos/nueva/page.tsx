import { redirect }    from "next/navigation";
import { auth }         from "@/lib/auth";
import { prisma }       from "@/lib/prisma";
import { NewBoatForm }  from "@/components/proveedor/new-boat-form";

export default async function NuevaEmbarcacion() {
  const session = await auth();
  if (!session) redirect("/login");

  const branches = await prisma.branch.findMany({
    where:   { companyId: session.user.companyId, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva embarcación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agregá un barco a la flota del puerto.
        </p>
      </div>
      <NewBoatForm branches={branches} />
    </main>
  );
}
