// Server layout — second gate for the admin section.
// Redirects unauthenticated users and non-ADMIN roles. Also renders AppNav.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { PortBannerSsr } from "@/components/puerto/PortBannerSsr";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { role, firstName, lastName, companyId } = session.user;
  if (role !== "ADMIN") {
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
        homeHref="/admin"
      />
      <PortBannerSsr companyId={companyId} />
      {children}
    </div>
  );
}
