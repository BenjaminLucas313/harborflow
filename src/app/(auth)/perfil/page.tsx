import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PerfilClient } from "./_perfil-client";

export default async function PerfilPage(props: {
  searchParams: Promise<{ tab?: string; forced?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const forced = searchParams.forced === "true";

  return (
    <PerfilClient
      user={{
        firstName: session.user.firstName,
        lastName:  session.user.lastName,
        email:     session.user.email ?? "",
        role:      session.user.role,
      }}
      defaultTab={searchParams.tab === "password" || forced ? "password" : "info"}
      forced={forced}
    />
  );
}
