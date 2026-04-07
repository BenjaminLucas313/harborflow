// Server layout — second gate for the operator section.
// Allows OPERATOR and ADMIN roles. Also renders the shared AppNav.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { role, firstName, lastName, companyId } = session.user;
  if (role !== "OPERATOR" && role !== "ADMIN") {
    redirect(dashboardForRole(role));
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppNav
        firstName={firstName}
        lastName={lastName}
        role={role}
        companyName={company?.name}
        homeHref="/operator"
      />
      {children}
    </div>
  );
}
