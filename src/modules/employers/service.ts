import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import {
  findEmployerById,
  listEmployers as repoList,
  createEmployer as repoCreate,
  updateEmployer as repoUpdate,
} from "./repository";
import type { CreateEmployerInput, UpdateEmployerInput } from "./schema";
import type { Employer } from "@prisma/client";

export async function listEmployers(companyId: string): Promise<Employer[]> {
  return repoList(companyId);
}

export async function getEmployerById(
  id: string,
  companyId: string,
): Promise<Employer> {
  const employer = await findEmployerById(id);
  if (!employer || employer.companyId !== companyId) {
    throw new AppError("EMPLOYER_NOT_FOUND", "Empleador no encontrado.", 404);
  }
  return employer;
}

export async function createEmployer(
  input: CreateEmployerInput,
  actorId: string,
): Promise<Employer> {
  const employer = await repoCreate({
    companyId: input.companyId,
    name:      input.name,
    taxId:     input.taxId,
  });

  logAction({
    companyId:  input.companyId,
    actorId,
    action:     "EMPLOYER_CREATED",
    entityType: "Employer",
    entityId:   employer.id,
    payload:    { name: employer.name, taxId: employer.taxId },
  }).catch(() => {});

  return employer;
}

export async function updateEmployer(
  id: string,
  companyId: string,
  data: UpdateEmployerInput,
  actorId: string,
): Promise<Employer> {
  const employer = await findEmployerById(id);
  if (!employer || employer.companyId !== companyId) {
    throw new AppError("EMPLOYER_NOT_FOUND", "Empleador no encontrado.", 404);
  }

  const updated = await repoUpdate(id, data);

  logAction({
    companyId,
    actorId,
    action:     "EMPLOYER_UPDATED",
    entityType: "Employer",
    entityId:   id,
    payload:    data,
  }).catch(() => {});

  return updated;
}
