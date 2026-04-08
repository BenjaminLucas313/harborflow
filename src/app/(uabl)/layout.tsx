// Server layout — gate for the UABL staff section.
// UABL staff confirm/reject seat requests scoped to their department.
import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function UablLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "UABL_STAFF") {
    redirect(dashboardForRole(session.user.role));
  }
  return <>{children}</>;
}
