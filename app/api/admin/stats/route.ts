import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { getAdminDepartmentIds, getDepartmentScopedIssueFilter, isSuperAdmin } from "@/lib/rbac";
import { getOrSetCache } from "@/lib/server-cache";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getTrendDirection(current: number, previous: number) {
  if (current > previous) return "up" as const;
  if (current < previous) return "down" as const;
  return "flat" as const;
}

export async function GET(request: Request) {
  await connectDB();

  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const issueScopeFilter = getDepartmentScopedIssueFilter(auth.user);
    const scopeKey = isSuperAdmin(auth.user)
      ? "all"
      : getAdminDepartmentIds(auth.user).sort().join(",") || "none";
    const cacheKey = `admin:stats:${auth.user._id}:${scopeKey}`;

    const payload = await getOrSetCache(cacheKey, 15_000, async () => {
      const [studentCount, facultyCount, staffCount, deptCount, metricRows, topDepartmentRows] =
        await Promise.all([
          User.countDocuments({ role: "student" }),
          User.countDocuments({ role: "faculty" }),
          User.countDocuments({ role: "staff" }),
          Department.countDocuments({}),
          Issue.aggregate([
            { $match: issueScopeFilter },
            {
              $group: {
                _id: null,
                issues: { $sum: 1 },
                pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
                assigned: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$assignedStaff", null] },
                          { $in: ["$status", ["Pending", "In Progress"]] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                unassigned: { $sum: { $cond: [{ $eq: ["$assignedStaff", null] }, 1, 0] } },
                overdue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$dueDate", null] },
                          { $lt: ["$dueDate", now] },
                          { $ne: ["$status", "Resolved"] },
                          { $ne: ["$status", "Rejected"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                recurring: { $sum: { $cond: [{ $eq: ["$recurring", true] }, 1, 0] } },
                pendingCurrentMonth: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "Pending"] },
                          { $gte: ["$createdAt", startOfCurrentMonth] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                pendingPreviousMonth: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "Pending"] },
                          { $gte: ["$createdAt", startOfPreviousMonth] },
                          { $lt: ["$createdAt", startOfCurrentMonth] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                resolvedCurrentMonth: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "Resolved"] },
                          { $gte: ["$createdAt", startOfCurrentMonth] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                resolvedPreviousMonth: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "Resolved"] },
                          { $gte: ["$createdAt", startOfPreviousMonth] },
                          { $lt: ["$createdAt", startOfCurrentMonth] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]),
          Issue.aggregate([
            { $match: issueScopeFilter },
            {
              $project: {
                scopedDepartment: {
                  $ifNull: ["$serviceDepartment", { $ifNull: ["$academicDepartment", "$department"] }],
                },
              },
            },
            { $match: { scopedDepartment: { $ne: null } } },
            { $group: { _id: "$scopedDepartment", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
          ]),
        ]);

      const metrics = metricRows[0] || {};
      const topDepartmentId = topDepartmentRows[0]?._id ? String(topDepartmentRows[0]._id) : "";
      const topDepartmentDoc = topDepartmentId
        ? await Department.findById(topDepartmentId).select("name").lean()
        : null;
      const topDepartment = topDepartmentDoc?.name
        ? {
            name: String(topDepartmentDoc.name),
            count: toNumber(topDepartmentRows[0]?.count),
          }
        : null;

      const pendingCurrentMonth = toNumber(metrics.pendingCurrentMonth);
      const pendingPreviousMonth = toNumber(metrics.pendingPreviousMonth);
      const resolvedCurrentMonth = toNumber(metrics.resolvedCurrentMonth);
      const resolvedPreviousMonth = toNumber(metrics.resolvedPreviousMonth);

      return {
        students: studentCount,
        faculty: facultyCount,
        staff: staffCount,
        departments: deptCount,
        issues: toNumber(metrics.issues),
        pending: toNumber(metrics.pending),
        inProgress: toNumber(metrics.inProgress),
        assigned: toNumber(metrics.assigned),
        resolved: toNumber(metrics.resolved),
        needsAttention: {
          unassigned: toNumber(metrics.unassigned),
          overdue: toNumber(metrics.overdue),
          recurring: toNumber(metrics.recurring),
        },
        insights: {
          topDepartment,
        },
        trends: {
          pending: {
            current: pendingCurrentMonth,
            previous: pendingPreviousMonth,
            direction: getTrendDirection(pendingCurrentMonth, pendingPreviousMonth),
          },
          resolved: {
            current: resolvedCurrentMonth,
            previous: resolvedPreviousMonth,
            direction: getTrendDirection(resolvedCurrentMonth, resolvedPreviousMonth),
          },
        },
      };
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    console.error("Admin stats error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}