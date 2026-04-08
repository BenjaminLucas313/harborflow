// Server layout — gate for the employee section.
// Employees can only view their assigned trips — no booking actions.
import { auth } from "@/lib/auth";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "EMPLOYEE") {
    redirect(dashboardForRole(session.user.role));
  }
  return <>{children}</>;
}
