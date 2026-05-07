import Link from "next/link";
import { Anchor } from "lucide-react";
import { auth } from "@/lib/auth";

const ROLE_DASHBOARD: Record<string, string> = {
  UABL:      "/uabl",
  EMPRESA:   "/empresa",
  PROVEEDOR: "/proveedor",
  CONDUCTOR: "/conductor",
  USUARIO:   "/usuario",
};

export default async function NotFound() {
  const session = await auth();
  const href = session?.user.role
    ? (ROLE_DASHBOARD[session.user.role] ?? "/login")
    : "/login";

  return (
    <main className="min-h-svh bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Anchor className="h-10 w-10 text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            La página que buscás no existe o fue movida.
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
