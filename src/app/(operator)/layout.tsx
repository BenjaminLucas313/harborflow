// Server layout — second gate for the operator section.
// Allows OPERATOR and ADMIN roles; all other roles are sent to their own dashboard.
// ADMINs have full company access and may use operator views (manifests, check-in, etc.).

import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");

  const { role } = session.user;
  if (role !== "OPERATOR" && role !== "ADMIN") {
    redirect(dashboardForRole(role));
  }

  return <>{children}</>;
}
