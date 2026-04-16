import { redirect } from "next/navigation";
import Link         from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth }    from "@/lib/auth";
import { prisma }  from "@/lib/prisma";
import { UsuariosPanel } from "@/components/uabl/usuarios-panel";

export default async function UablUsuarios() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.isUablAdmin) redirect("/uabl");

  const { companyId } = session.user;

  const [users, branches, departments] = await Promise.all([
    prisma.user.findMany({
      where:   { companyId },
      select: {
        id:          true,
        email:       true,
        firstName:   true,
        lastName:    true,
        role:        true,
        isActive:    true,
        isUablAdmin: true,
        createdAt:   true,
        branch:      { select: { name: true } },
        department:  { select: { name: true } },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
    }),
    prisma.branch.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where:   { companyId, isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
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
        <h1 className="text-2xl font-semibold tracking-tight">Gestión de usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creá y consultá usuarios de todos los roles dentro de esta organización.
        </p>
      </div>

      <UsuariosPanel
        users={users}
        branches={branches}
        departments={departments}
      />
    </main>
  );
}
