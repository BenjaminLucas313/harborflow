// Admin trips page — /admin/trips
// Server component: fetches trips, boats, and drivers for the session's branch,
// then renders a read-only trip list and a collapsible create-trip form.

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTripsByBranch } from "@/modules/trips/service";
import { TripList } from "@/components/trips/trip-list";
import { CreateTripForm } from "@/components/trips/create-trip-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.trips");
  return { title: t("metaTitle") };
}

export default async function AdminTripsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const t = await getTranslations("admin.trips");
  const { companyId, branchId } = session.user;

  // ADMINs without a branch assignment cannot manage trips yet.
  if (!branchId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("noBranchAssigned")}</p>
      </main>
    );
  }

  // Fetch all data in parallel — all queries are scoped to the session's branch.
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
      <CreateTripForm
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
