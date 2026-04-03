// Admin dashboard at /admin.

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName, lastName, companyId } = session.user;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bienvenido, {firstName} {lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empresa: <span className="font-mono text-xs">{companyId}</span>
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Navigation */}
      <nav aria-label="Secciones">
        <ul className="space-y-2">
          <li>
            <Link
              href="/admin/trips"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Viajes →
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
