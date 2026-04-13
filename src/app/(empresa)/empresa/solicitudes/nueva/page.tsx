import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CreateTripRequestForm } from "@/components/empresa/create-trip-request-form";

export default async function NuevaSolicitud() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva solicitud de lancha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completá los datos del traslado. El proveedor recibirá tu solicitud y responderá a la brevedad.
        </p>
      </div>
      <CreateTripRequestForm />
    </main>
  );
}
