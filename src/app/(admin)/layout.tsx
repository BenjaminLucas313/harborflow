// Server layout — second gate for the admin section.
// Redirects unauthenticated users and non-ADMIN roles.

import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");

  if (session.user.role !== "ADMIN") {
    redirect(dashboardForRole(session.user.role));
  }

  return <>{children}</>;
}
