import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DepartmentForm } from "@/components/uabl/department-form";

export default async function UablDepartamentos() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.isUablAdmin) redirect("/uabl");

  const { companyId } = session.user;

  const departments = await prisma.department.findMany({
    where:   { companyId },
    orderBy: { name: "asc" },
    select: {
      id:          true,
      name:        true,
      description: true,
      isActive:    true,
      _count:      { select: { workTypes: true, users: true } },
    },
  });

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
        <h1 className="text-2xl font-semibold tracking-tight">Departamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada departamento UABL revisa y aprueba los slots de sus tipos de trabajo.
        </p>
      </div>

      {/* Create form */}
      <DepartmentForm companyId={companyId} />

      {/* List */}
      {departments.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground border rounded-2xl">
          No hay departamentos registrados.
        </div>
      ) : (
        <ul className="space-y-2">
          {departments.map((dept) => (
            <li
              key={dept.id}
              className={`rounded-xl border bg-card px-4 py-3 flex items-center justify-between gap-4 ${!dept.isActive ? "opacity-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{dept.name}</p>
                {dept.description && (
                  <p className="text-xs text-muted-foreground">{dept.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dept._count.workTypes} tipos de trabajo · {dept._count.users} usuarios
                </p>
              </div>
              <span
                className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${dept.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                {dept.isActive ? "Activo" : "Inactivo"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
