// Server layout — second gate for the passenger section.
// Middleware is the first gate; this layout defends against any bypass.
// Also renders the shared AppNav for all passenger pages.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";

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

  const { firstName, lastName, companyId } = session.user;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppNav
        firstName={firstName}
        lastName={lastName}
        role="PASSENGER"
        companyName={company?.name}
        homeHref="/passenger"
      />
      {children}
    </div>
  );
}
