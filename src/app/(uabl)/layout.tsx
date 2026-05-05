import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardForRole } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { PortBannerSsr } from "@/components/puerto/PortBannerSsr";

export default async function UablLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "UABL") {
    redirect(dashboardForRole(session.user.role));
  }

  const { firstName, lastName, companyId, departmentId, isUablAdmin } = session.user;
  const [company, department] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    departmentId
      ? prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })
      : null,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <AppNav
        firstName={firstName}
        lastName={lastName}
        role="UABL"
        isUablAdmin={isUablAdmin}
        departmentName={department?.name}
        companyName={company?.name}
        homeHref="/uabl"
        assistantHref="/uabl/assistant"
      />
      <PortBannerSsr companyId={companyId} />
      {children}
    </div>
  );
}
