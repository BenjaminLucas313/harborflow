// /uabl/assistant — UABL AI Assistant standalone page
//
// Server component:
//   - Auth + UABL role guard
//   - Resolves current Argentina month/year for default period
//   - Resolves first active branch name for the subtitle
//   - Renders UablAssistant (client component — all interactive)

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UablAssistant } from "@/components/uabl/UablAssistant";

/** Argentina current month/year (UTC-3, no DST). */
function argNow(): { mes: number; anio: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return {
    mes:  now.getUTCMonth() + 1,
    anio: now.getUTCFullYear(),
  };
}

export default async function AssistantPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "UABL") redirect("/uabl");

  const { companyId } = session.user;

  const firstBranch = await prisma.branch.findFirst({
    where:   { companyId, isActive: true },
    select:  { name: true },
    orderBy: { name: "asc" },
  });

  const { mes, anio } = argNow();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <UablAssistant
        mes={mes}
        anio={anio}
        branchName={firstBranch?.name ?? "Puerto Rosario"}
      />
    </main>
  );
}
