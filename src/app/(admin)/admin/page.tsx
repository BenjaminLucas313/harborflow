// Admin dashboard at /admin.

import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { auth } from "@/lib/auth";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName } = session.user;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrate your company operations.
        </p>
      </div>

      {/* Navigation cards */}
      <nav aria-label="Secciones" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/trips"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <LayoutDashboard className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Viajes</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Create and manage trip schedules for your branch.
          </p>
        </Link>
      </nav>
    </main>
  );
}
