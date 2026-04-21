import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dashboardForRole } from "@/lib/routes";
import { AppNav } from "@/components/layout/app-nav";

export default async function AuthSharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { firstName, lastName, role, companyId } = session.user;
  const homeHref = dashboardForRole(role);

  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppNav
        firstName={firstName}
        lastName={lastName}
        role={role}
        companyName={company?.name}
        homeHref={homeHref}
      />
      {children}
    </div>
  );
}
