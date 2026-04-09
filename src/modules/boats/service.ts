// Boat service: create, update, deactivate. Capacity changes must not affect existing trips.

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createBoat as repoCreate } from "./repository";
import type { CreateBoatInput } from "./schema";

export async function createBoat(
  input: Omit<CreateBoatInput, "companyId">,
  ctx: { companyId: string },
) {
  // Validate the branch belongs to this company and is active.
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, companyId: ctx.companyId, isActive: true },
    select: { id: true },
  });
  if (!branch) {
    throw new AppError("NOT_FOUND", "Puerto no encontrado.", 404);
  }

  return repoCreate({ ...input, companyId: ctx.companyId });
}
