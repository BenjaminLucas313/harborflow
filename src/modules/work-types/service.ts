import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import {
  listWorkTypes as repoList,
  createWorkType as repoCreate,
  updateWorkType as repoUpdate,
  findWorkTypeById,
} from "./repository";
import { findDepartmentById } from "@/modules/departments/repository";
import type { CreateWorkTypeInput, UpdateWorkTypeInput } from "./schema";
import type { WorkType } from "@prisma/client";

export async function listWorkTypes(
  companyId: string,
  departmentId?: string,
): Promise<WorkType[]> {
  return repoList(companyId, departmentId);
}

/**
 * Creates a new work type. Only callable by UABL admin users.
 *
 * Throws:
 *   DEPARTMENT_NOT_FOUND (404) — departmentId does not exist in this company
 */
export async function createWorkType(
  input: CreateWorkTypeInput,
  actorId: string,
): Promise<WorkType> {
  const dept = await findDepartmentById(input.departmentId);
  if (!dept || dept.companyId !== input.companyId) {
    throw new AppError("DEPARTMENT_NOT_FOUND", "Departamento no encontrado.", 404);
  }

  const wt = await repoCreate({
    companyId:    input.companyId,
    departmentId: input.departmentId,
    name:         input.name,
    code:         input.code,
  });

  logAction({
    companyId:  input.companyId,
    actorId,
    action:     "WORKTYPE_CREATED",
    entityType: "WorkType",
    entityId:   wt.id,
    payload:    { name: wt.name, code: wt.code, departmentId: wt.departmentId },
  }).catch(() => {});

  return wt;
}

export async function updateWorkType(
  id: string,
  companyId: string,
  data: UpdateWorkTypeInput,
  actorId: string,
): Promise<WorkType> {
  const wt = await findWorkTypeById(id);
  if (!wt || wt.companyId !== companyId) {
    throw new AppError("WORKTYPE_NOT_FOUND", "Tipo de trabajo no encontrado.", 404);
  }

  const updated = await repoUpdate(id, data);

  logAction({
    companyId,
    actorId,
    action:     "WORKTYPE_UPDATED",
    entityType: "WorkType",
    entityId:   id,
    payload:    data,
  }).catch(() => {});

  return updated;
}
