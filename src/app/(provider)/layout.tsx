// Server layout — gate for the provider section.
// Provider manages vessels, schedules, and port status.
import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "PROVIDER") {
    redirect(dashboardForRole(session.user.role));
  }
  return <>{children}</>;
}
