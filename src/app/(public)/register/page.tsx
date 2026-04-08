// V2: Public self-registration is disabled.
// Employee accounts are created by administrators.
import Link from "next/link";

export const metadata = { title: "Registro no disponible" };

export default function RegisterPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Registro no disponible</h1>
        <p className="text-sm text-muted-foreground">
          Las cuentas son creadas por los administradores del sistema. Si necesitás acceso,
          contactá a tu empresa o a la autoridad del puerto.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
