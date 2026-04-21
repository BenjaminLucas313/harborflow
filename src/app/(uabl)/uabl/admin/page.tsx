import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Building2, Wrench, Users } from "lucide-react";

export default async function UablAdmin() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.isUablAdmin) redirect("/uabl");

  const { companyId } = session.user;

  const [deptCount, workTypeCount, userCount] = await Promise.all([
    prisma.department.count({ where: { companyId, isActive: true } }),
    prisma.workType.count({ where: { companyId, isActive: true } }),
    prisma.user.count({ where: { companyId, isActive: true } }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administración UABL</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná departamentos y tipos de trabajo disponibles en el sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/uabl/admin/departamentos"
          className="rounded-2xl border border-border bg-card p-6 space-y-3 hover:shadow-sm transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-2.5">
              <Building2 className="size-5 text-violet-700" />
            </div>
            <div>
              <p className="font-semibold group-hover:text-primary transition-colors">Departamentos</p>
              <p className="text-sm text-muted-foreground">{deptCount} activos</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Creá y gestioná los departamentos de UABL. Cada departamento revisa sus propios slots.
          </p>
        </Link>

        <Link
          href="/uabl/admin/tipos-trabajo"
          className="rounded-2xl border border-border bg-card p-6 space-y-3 hover:shadow-sm transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2.5">
              <Wrench className="size-5 text-blue-700" />
            </div>
            <div>
              <p className="font-semibold group-hover:text-primary transition-colors">Tipos de trabajo</p>
              <p className="text-sm text-muted-foreground">{workTypeCount} activos</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Definí los tipos de trabajo disponibles y asignalos a sus departamentos correspondientes.
          </p>
        </Link>
        <Link
          href="/uabl/admin/usuarios"
          className="rounded-2xl border border-border bg-card p-6 space-y-3 hover:shadow-sm transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5">
              <Users className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold group-hover:text-primary transition-colors">Gestión de usuarios</p>
              <p className="text-sm text-muted-foreground">{userCount} activos</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Creá usuarios UABL, PROVEEDOR y EMPRESA. Los usuarios creados aquí reciben sus credenciales directamente.
          </p>
        </Link>
      </div>
    </main>
  );
}
