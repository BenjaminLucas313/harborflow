import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkTypeForm } from "@/components/uabl/work-type-form";

export default async function UablTiposTrabajo() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.isUablAdmin) redirect("/uabl");

  const { companyId } = session.user;

  const [departments, workTypes] = await Promise.all([
    prisma.department.findMany({
      where:   { companyId, isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    prisma.workType.findMany({
      where:   { companyId },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        id:         true,
        name:       true,
        code:       true,
        isActive:   true,
        department: { select: { name: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/uabl/admin"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Admin
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tipos de trabajo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lista cerrada de tipos de trabajo. Cada tipo pertenece a un departamento UABL.
        </p>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Primero creá al menos un{" "}
          <Link href="/uabl/admin/departamentos" className="underline">departamento</Link>{" "}
          antes de agregar tipos de trabajo.
        </div>
      ) : (
        <WorkTypeForm departments={departments} />
      )}

      {workTypes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground border rounded-2xl">
          No hay tipos de trabajo registrados.
        </div>
      ) : (
        <ul className="space-y-2">
          {workTypes.map((wt) => (
            <li
              key={wt.id}
              className={`rounded-xl border bg-card px-4 py-3 flex items-center justify-between gap-4 ${!wt.isActive ? "opacity-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{wt.name}</p>
                <p className="text-xs text-muted-foreground">
                  {wt.department.name} · código: <code className="font-mono">{wt.code}</code>
                </p>
              </div>
              <span
                className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${wt.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                {wt.isActive ? "Activo" : "Inactivo"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
