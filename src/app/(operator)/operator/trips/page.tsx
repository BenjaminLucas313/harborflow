// Operator trips page — /operator/trips
// Accessible to OPERATOR and ADMIN roles (layout enforces this).
//
// Server component: fetches trips, boats, and drivers scoped to the session's
// branch, then renders a read-only trip list and a collapsible create form.

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTripsByBranch } from "@/modules/trips/service";
import { TripList } from "@/components/trips/trip-list";
import { TripForm } from "@/components/trips/trip-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trips");
  return { title: t("metaTitle") };
}

export default async function OperatorTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const t = await getTranslations("trips");
  const { companyId, branchId } = session.user;

  // Operators without a branch assignment cannot view or create trips.
  if (!branchId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("noBranchAssigned")}</p>
      </main>
    );
  }

  // Fetch trips, boats, and drivers in parallel — all scoped to the session branch.
  const [trips, boats, drivers] = await Promise.all([
    listTripsByBranch({ branchId }),
    prisma.boat.findMany({
      where: { branchId, companyId, isActive: true },
      select: { id: true, name: true, capacity: true },
      orderBy: { name: "asc" },
    }),
    prisma.driver.findMany({
      where: { branchId, companyId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>

      {/* Create trip — client component managing its own open/close state */}
      <TripForm
        boats={boats}
        drivers={drivers}
        branchId={branchId}
        companyId={companyId}
      />

      {/* Trip list — server rendered */}
      <TripList trips={trips} />
    </main>
  );
}
