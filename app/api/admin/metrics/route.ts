import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import User from "@/models/User";
import {
  getAdminDepartmentIds,
  getDepartmentScopedIssueFilter,
  isSuperAdmin,
} from "@/lib/rbac";
import { getOrSetCache } from "@/lib/server-cache";

type MetricsScope = "staff" | "students" | "departments";

function isValidScope(value: string): value is MetricsScope {
  return value === "staff" || value === "students" || value === "departments";
}

function toCountMap(rows: Array<{ _id?: unknown; count?: number }>) {
  const map: Record<string, number> = {};

  rows.forEach((row) => {
    const key = row?._id ? String(row._id) : "";
    if (!key) return;
    map[key] = Number(row.count || 0);
  });

  return map;
}

export async function GET(request: Request) {
  await connectDB();

  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const scopeParam = (params.get("scope") || "").trim().toLowerCase();

  if (!isValidScope(scopeParam)) {
    return NextResponse.json(
      { message: "Invalid scope. Expected one of: staff, students, departments." },
      { status: 400 }
    );
  }

  const issueScopeFilter = getDepartmentScopedIssueFilter(auth.user);
  const scopeIds = getAdminDepartmentIds(auth.user);
  const scopeKey = isSuperAdmin(auth.user) ? "all" : scopeIds.sort().join(",") || "none";
  const cacheKey = `admin:metrics:${auth.user._id}:${scopeKey}:${scopeParam}`;

  try {
    const payload = await getOrSetCache(cacheKey, 15_000, async () => {
      if (scopeParam === "staff") {
        const rows = await Issue.aggregate([
          {
            $match: {
              ...issueScopeFilter,
              assignedStaff: { $ne: null },
              status: { $in: ["Pending", "In Progress"] },
            },
          },
          { $group: { _id: "$assignedStaff", count: { $sum: 1 } } },
        ]);

        return {
          activeIssueByStaff: toCountMap(rows),
        };
      }

      if (scopeParam === "students") {
        const rows = await Issue.aggregate([
          { $match: issueScopeFilter },
          { $match: { student: { $ne: null } } },
          { $group: { _id: "$student", count: { $sum: 1 } } },
        ]);

        return {
          issueCountByStudent: toCountMap(rows),
        };
      }

      const [issueRows, staffRows] = await Promise.all([
        Issue.aggregate([
          {
            $match: {
              ...issueScopeFilter,
              status: { $in: ["Pending", "In Progress"] },
            },
          },
          {
            $project: {
              scopedDepartment: {
                $ifNull: ["$serviceDepartment", { $ifNull: ["$academicDepartment", "$department"] }],
              },
            },
          },
          { $match: { scopedDepartment: { $ne: null } } },
          { $project: { deptId: { $toString: "$scopedDepartment" } } },
          { $group: { _id: "$deptId", count: { $sum: 1 } } },
        ]),
        User.aggregate([
          {
            $match: {
              role: "staff",
              ...(process.env.NODE_ENV === "production" ? { isDemoUser: { $ne: true } } : {}),
            },
          },
          {
            $project: {
              deptRefs: {
                $setUnion: [
                  { $cond: [{ $ne: ["$department", null] }, ["$department"], []] },
                  { $cond: [{ $ne: ["$academicDepartment", null] }, ["$academicDepartment"], []] },
                  { $cond: [{ $ne: ["$serviceDepartment", null] }, ["$serviceDepartment"], []] },
                  { $ifNull: ["$managedDepartments", []] },
                ],
              },
            },
          },
          { $unwind: "$deptRefs" },
          { $project: { deptId: { $toString: "$deptRefs" } } },
          ...(isSuperAdmin(auth.user)
            ? []
            : [{ $match: { deptId: { $in: scopeIds.map((id) => String(id)) } } }]),
          { $group: { _id: "$deptId", count: { $sum: 1 } } },
        ]),
      ]);

      return {
        activeIssueByDepartment: toCountMap(issueRows),
        staffByDepartment: toCountMap(staffRows),
      };
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    console.error("Admin metrics error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
