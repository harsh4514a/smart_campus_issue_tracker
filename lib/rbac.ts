import type { IUser } from "@/models/User";

type IssueScopeShape = {
  department?: unknown;
  academicDepartment?: unknown;
  serviceDepartment?: unknown;
  assignedStaff?: unknown;
};

function extractId(value: unknown) {
  let current: unknown = value;
  const seen = new Set<unknown>();

  while (current) {
    if (typeof current === "string") return current;
    if (typeof current === "number") return String(current);

    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) return "";
      seen.add(current);

      if ("_id" in current) {
        const nested = (current as { _id?: unknown })._id;
        if (nested && nested !== current) {
          current = nested;
          continue;
        }
      }

      if ("toString" in current) {
        const asString = (current as { toString: () => string }).toString();
        return asString === "[object Object]" ? "" : asString;
      }
    }

    return "";
  }

  return "";
}

export function isSuperAdmin(user: IUser) {
  return user.role === "admin" && (user.adminRole === "super_admin" || !user.adminRole);
}

export function isDeptAdmin(user: IUser) {
  return user.role === "admin" && user.adminRole === "dept_admin";
}

export function getAdminDepartmentIds(user: IUser) {
  const managedDepartmentIds = Array.isArray(user.managedDepartments)
    ? user.managedDepartments
    : [];

  return [user.department, user.academicDepartment, user.serviceDepartment, ...managedDepartmentIds]
    .map(extractId)
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

export function getDepartmentScopedIssueFilter(user: IUser) {
  if (isSuperAdmin(user)) return {};

  if (isDeptAdmin(user)) {
    const ids = getAdminDepartmentIds(user);

    return {
      $or: [
        { department: { $in: ids } },
        { academicDepartment: { $in: ids } },
        { serviceDepartment: { $in: ids } },
      ],
    };
  }

  return { assignedStaff: user._id };
}

export function canAdminAccessIssue(user: IUser, issue: IssueScopeShape) {
  if (isSuperAdmin(user)) return true;

  if (isDeptAdmin(user)) {
    const scopeIds = new Set(getAdminDepartmentIds(user));
    const issueDepartmentIds = [issue.department, issue.academicDepartment, issue.serviceDepartment]
      .map(extractId)
      .filter(Boolean);

    return issueDepartmentIds.some((id) => scopeIds.has(id));
  }

  return extractId(issue.assignedStaff) === extractId(user._id);
}
