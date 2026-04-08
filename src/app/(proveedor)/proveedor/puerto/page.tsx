import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortStatusForm } from "@/components/proveedor/port-status-form";

export default async function ProveedorPuerto() {
  const session = await auth();
  if (!session) redirect("/login");

  const { companyId } = session.user;

  const branches = await prisma.branch.findMany({
    where:   { companyId, isActive: true },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Current status per branch.
  const currentStatuses = await Promise.all(
    branches.map(async (b) => {
      const ps = await prisma.portStatus.findFirst({
        where:   { branchId: b.id },
        orderBy: { createdAt: "desc" },
        select:  { status: true, message: true, createdAt: true },
      });
      return { branch: b, portStatus: ps };
    }),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estado del puerto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Abrí o cerrá el puerto e informá el motivo a los usuarios.
        </p>
      </div>

      {/* Current status display */}
      {currentStatuses.map(({ branch, portStatus: ps }) => {
        const isOpen = !ps || ps.status === "OPEN";
        return (
          <div
            key={branch.id}
            className={`rounded-2xl border p-5 space-y-1 ${isOpen ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
          >
            <div className="flex items-center justify-between">
              <p className={`font-semibold ${isOpen ? "text-emerald-800" : "text-red-800"}`}>
                {branch.name}: {isOpen ? "Abierto" : ps?.status?.replace("_", " ")}
              </p>
              {ps && (
                <p className="text-xs text-muted-foreground">
                  {new Date(ps.createdAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                </p>
              )}
            </div>
            {ps?.message && (
              <p className={`text-sm ${isOpen ? "text-emerald-700" : "text-red-700"}`}>
                {ps.message}
              </p>
            )}
          </div>
        );
      })}

      {/* Change status form */}
      <PortStatusForm branches={branches} />
    </main>
  );
}
