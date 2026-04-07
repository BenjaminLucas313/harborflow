// Operator trips page — /operator/trips
// Accessible to OPERATOR and ADMIN roles (layout enforces this).

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

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
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">
          {t("pageTitle")}
        </h1>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/40 dark:bg-amber-950/30">
          <AlertCircle
            className="size-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {t("noBranchAssigned")}
          </p>
        </div>
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
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your branch schedule and access passenger manifests.
        </p>
      </div>

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
