// =============================================================================
// PortBannerSsr — Server component: fetches port status, renders PuertoBanner
// =============================================================================
//
// Queries the most recent PortStatus for every branch belonging to `companyId`.
// If all branches are OPEN (or the company has no branches with status records),
// renders nothing. Otherwise renders PuertoBanner with the most critical status.
//
// Priority: CERRADO (2) > ADVERTENCIA (1) > OPERATIVO (0).
//
// This is a server component — it owns the data-fetching so the banner works
// in any layout without client-side fetch or context.
//
// USAGE
// -----
//   <PortBannerSsr companyId={session.user.companyId} />
//
// =============================================================================

import { prisma } from "@/lib/prisma";
import { PuertoBanner } from "./PuertoBanner";
import { getDisplayStatus } from "./port-status-config";
import type { PortStatusValue } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  companyId: string;
};

// ---------------------------------------------------------------------------
// Priority mapping for display categories
// ---------------------------------------------------------------------------

const DISPLAY_PRIORITY = {
  CERRADO:     2,
  ADVERTENCIA: 1,
  OPERATIVO:   0,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export async function PortBannerSsr({ companyId }: Props) {
  // For each branch in the company, fetch the single most recent PortStatus.
  const branches = await prisma.branch.findMany({
    where:  { companyId },
    select: {
      name: true,
      portStatuses: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { id: true, status: true, message: true },
      },
    },
  });

  // Walk branches and track the highest-priority non-OPEN status.
  let best: {
    statusId:   string;
    status:     PortStatusValue;
    message:    string | null;
    branchName: string;
    priority:   number;
  } | null = null;

  for (const branch of branches) {
    const latest = branch.portStatuses[0];
    if (!latest) continue;

    const display  = getDisplayStatus(latest.status);
    if (display === "OPERATIVO") continue;

    const priority = DISPLAY_PRIORITY[display];
    if (!best || priority > best.priority) {
      best = {
        statusId:   latest.id,
        status:     latest.status,
        message:    latest.message ?? null,
        branchName: branch.name,
        priority,
      };
    }
  }

  if (!best) return null;

  return (
    <PuertoBanner
      status={best.status}
      message={best.message}
      statusId={best.statusId}
      branchName={best.branchName}
    />
  );
}
