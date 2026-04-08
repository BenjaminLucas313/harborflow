import { redirect } from "next/navigation";
import Link from "next/link";
import { Ship } from "lucide-react";
import { auth } from "@/lib/auth";

export default async function UsuarioDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName } = session.user;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenido, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acá podés ver los viajes en los que fuiste asignado.
        </p>
      </div>

      <nav aria-label="Secciones" className="grid gap-4 sm:grid-cols-1 max-w-sm">
        <Link
          href="/usuario/viajes"
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/15">
              <Ship className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Mis viajes</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ver los viajes a los que fuiste asignado y su estado de confirmación.
          </p>
        </Link>
      </nav>
    </main>
  );
}
