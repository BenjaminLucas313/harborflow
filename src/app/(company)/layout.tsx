// Server layout — gate for the company representative section.
import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "COMPANY_REP") {
    redirect(dashboardForRole(session.user.role));
  }
  return <>{children}</>;
}
