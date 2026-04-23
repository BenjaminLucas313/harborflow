import { redirect }            from "next/navigation";
import { auth }                from "@/lib/auth";
import { PerfilConductorForm } from "./perfil-form";

export default async function ConductorPerfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName, lastName, email } = session.user;

  return (
    <PerfilConductorForm
      initialFirstName={firstName ?? ""}
      initialLastName={lastName  ?? ""}
      email={email ?? ""}
    />
  );
}
