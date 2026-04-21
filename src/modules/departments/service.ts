import { AppError } from "@/lib/errors";
import { logAction } from "@/modules/audit/repository";
import {
  listDepartments as repoList,
  createDepartment as repoCreate,
  updateDepartment as repoUpdate,
  findDepartmentById,
} from "./repository";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "./schema";
import type { Department } from "@prisma/client";

export async function listDepartments(companyId: string): Promise<Department[]> {
  return repoList(companyId);
}

/**
 * Creates a new department. Only callable by UABL admin users.
 *
 * Throws:
 *   VALIDATION_ERROR (400) — department name already exists in this company
 */
export async function createDepartment(
  input: CreateDepartmentInput,
  actorId: string,
): Promise<Department> {
  const dept = await repoCreate({
    companyId:   input.companyId,
    name:        input.name,
    description: input.description,
  });

  logAction({
    companyId:  input.companyId,
    actorId,
    action:     "DEPARTMENT_CREATED",
    entityType: "Department",
    entityId:   dept.id,
    payload:    { name: dept.name },
  }).catch(() => {});

  return dept;
}

export async function updateDepartment(
  id: string,
  companyId: string,
  data: UpdateDepartmentInput,
  actorId: string,
): Promise<Department> {
  const dept = await findDepartmentById(id);
  if (!dept || dept.companyId !== companyId) {
    throw new AppError("DEPARTMENT_NOT_FOUND", "Departamento no encontrado.", 404);
  }

  const updated = await repoUpdate(id, data);

  logAction({
    companyId,
    actorId,
    action:     "DEPARTMENT_UPDATED",
    entityType: "Department",
    entityId:   id,
    payload:    data,
  }).catch(() => {});

  return updated;
}
