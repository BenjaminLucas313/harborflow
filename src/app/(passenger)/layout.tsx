// Server layout — second gate for the passenger section.
// Middleware is the first gate; this layout defends against any bypass
// (e.g. a direct RSC fetch, a future middleware misconfiguration).
//
// Redirects unauthenticated users and users with a non-PASSENGER role.

import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function PassengerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");

  if (session.user.role !== "PASSENGER") {
    redirect(dashboardForRole(session.user.role));
  }

  return <>{children}</>;
}
