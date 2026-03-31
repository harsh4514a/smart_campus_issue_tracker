import { NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";
import mongoose from "mongoose";
import { authenticateRequest } from "@/lib/auth";
import { canAdminAccessIssue, getAdminDepartmentIds, isDeptAdmin } from "@/lib/rbac";
import type { IUser } from "@/models/User";

export type DeptAdminAuthResult = {
  user: IUser;
  departmentIds: string[];
};

function sanitizeDepartmentIds(ids: string[]) {
  return ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
}

export async function requireDeptAdmin(request: Request): Promise<DeptAdminAuthResult | Response> {
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  if (!isDeptAdmin(auth.user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const departmentIds = sanitizeDepartmentIds(getAdminDepartmentIds(auth.user));
  if (departmentIds.length === 0) {
    return NextResponse.json(
      { message: "No assigned departments found for this account." },
      { status: 403 }
    );
  }

  return {
    user: auth.user,
    departmentIds,
  };
}

export function buildDepartmentScopeFilter(
  departmentIds: string[],
  selectedDepartmentId?: string | null
): FilterQuery<unknown> {
  const safeDepartmentIds = sanitizeDepartmentIds(departmentIds);
  const safeSelectedDepartmentId =
    selectedDepartmentId && mongoose.Types.ObjectId.isValid(selectedDepartmentId)
      ? selectedDepartmentId
      : null;

  const scopedDepartmentIds = selectedDepartmentId
    ? safeSelectedDepartmentId && safeDepartmentIds.includes(safeSelectedDepartmentId)
      ? [safeSelectedDepartmentId]
      : []
    : safeDepartmentIds;

  if (scopedDepartmentIds.length === 0) {
    return { _id: null };
  }

  const scopedDepartmentObjectIds = scopedDepartmentIds.map((id) => new mongoose.Types.ObjectId(id));

  return {
    $or: [
      { department: { $in: scopedDepartmentObjectIds } },
      { academicDepartment: { $in: scopedDepartmentObjectIds } },
      { serviceDepartment: { $in: scopedDepartmentObjectIds } },
    ],
  };
}

export function canDeptAdminAccessIssue(user: IUser, issue: unknown) {
  return canAdminAccessIssue(user, issue as { department?: unknown; academicDepartment?: unknown; serviceDepartment?: unknown });
}
