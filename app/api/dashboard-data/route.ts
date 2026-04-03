import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import User from "@/models/User";
import Department from "@/models/Department";
import Feedback from "@/models/Feedback";
import { getAdminDepartmentIds, getDepartmentScopedIssueFilter, isDeptAdmin, isSuperAdmin } from "@/lib/rbac";
import { getOrSetCache } from "@/lib/server-cache";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parsePositiveInt(raw: string | null, fallback: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
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

  const params = new URL(request.url).searchParams;
  const issuesLimit = parsePositiveInt(params.get("issuesLimit"), 120, 5000);
  const includeIssues = params.get("includeIssues") !== "0";
  const includeWorkers = params.get("includeWorkers") !== "0";
  const includeReports = params.get("includeReports") !== "0";

  const issueScopeFilter = getDepartmentScopedIssueFilter(auth.user);
  const scopeIds = getAdminDepartmentIds(auth.user);
  const scopeKey = isSuperAdmin(auth.user) ? "all" : scopeIds.sort().join(",") || "none";
  const cacheKey = `dashboard-data:${auth.user._id}:${scopeKey}:${issuesLimit}:${includeIssues ? 1 : 0}:${includeWorkers ? 1 : 0}:${includeReports ? 1 : 0}`;

  try {
    const payload = await getOrSetCache(cacheKey, 15_000, async () => {
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [studentCount, facultyCount, staffCount, departmentCount, metricRows, topDepartmentRows] =
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
                highPriorityPending: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "Pending"] },
                          { $in: ["$priority", ["High", "Urgent"]] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
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
      const pendingCurrentMonth = toNumber(metrics.pendingCurrentMonth);
      const pendingPreviousMonth = toNumber(metrics.pendingPreviousMonth);
      const resolvedCurrentMonth = toNumber(metrics.resolvedCurrentMonth);
      const resolvedPreviousMonth = toNumber(metrics.resolvedPreviousMonth);

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

      const stats = {
        students: studentCount,
        faculty: facultyCount,
        staff: staffCount,
        departments: departmentCount,
        issues: toNumber(metrics.issues),
        pending: toNumber(metrics.pending),
        inProgress: toNumber(metrics.inProgress),
        assigned: toNumber(metrics.assigned),
        resolved: toNumber(metrics.resolved),
        needsAttention: {
          unassigned: toNumber(metrics.unassigned),
          overdue: toNumber(metrics.overdue),
          highPriorityPending: toNumber(metrics.highPriorityPending),
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

      const issuesPromise = includeIssues
        ? Issue.find(issueScopeFilter)
            .select(
              "title category status location createdAt updatedAt priority recurring student assignedStaff department academicDepartment serviceDepartment"
            )
            .populate("student", "name email")
            .populate("assignedStaff", "_id name email")
            .populate("department", "_id name type")
            .populate("academicDepartment", "_id name type")
            .populate("serviceDepartment", "_id name type")
            .sort({ updatedAt: -1 })
            .limit(issuesLimit)
            .lean()
        : Promise.resolve([]);

      const reportsPromise = includeReports
        ? Promise.all([
            Feedback.aggregate([
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: "$rating" },
                  total: { $sum: 1 },
                },
              },
            ]),
            Issue.aggregate([
              { $match: issueScopeFilter },
              { $group: { _id: "$status", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
             ]),
            Issue.aggregate([
              { $match: issueScopeFilter },
              { $group: { _id: { $ifNull: ["$priority", "Unspecified"] }, count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ]),
           ])
         : Promise.resolve([[], [], []] as const);

      const workersPromise = includeWorkers
        ? (async () => {
            const workerFilter: Record<string, unknown> = {
              role: "staff",
              isActive: { $ne: false },
            };

            if (isDeptAdmin(auth.user)) {
              if (scopeIds.length === 0) return [];
              workerFilter.$or = [
                { department: { $in: scopeIds } },
                { academicDepartment: { $in: scopeIds } },
                { serviceDepartment: { $in: scopeIds } },
              ];
            }

            const rawWorkers = await User.find(workerFilter)
              .select("_id name email designation department academicDepartment serviceDepartment")
              .populate("department", "_id name type")
              .populate("academicDepartment", "_id name type")
              .populate("serviceDepartment", "_id name type")
              .sort({ name: 1 })
              .lean();

            const workerIds = rawWorkers.map((worker) => worker._id);
            if (workerIds.length === 0) return [];

            const loadRows = await Issue.aggregate([
              { $match: { ...issueScopeFilter, assignedStaff: { $in: workerIds } } },
              {
                $group: {
                  _id: "$assignedStaff",
                  totalAssigned: { $sum: 1 },
                  activeIssues: {
                    $sum: {
                      $cond: [{ $in: ["$status", ["Pending", "In Progress"]] }, 1, 0],
                    },
                  },
                  resolvedIssues: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0],
                    },
                  },
                },
              },
            ]);

            const loadMap = new Map(
              loadRows.map((row) => [
                String(row._id),
                {
                  totalAssigned: toNumber((row as { totalAssigned?: number }).totalAssigned),
                  activeIssues: toNumber((row as { activeIssues?: number }).activeIssues),
                  resolvedIssues: toNumber((row as { resolvedIssues?: number }).resolvedIssues),
                },
              ])
            );

            return rawWorkers
              .map((worker) => {
                const id = String(worker._id);
                const workerLoad = loadMap.get(id) || {
                  totalAssigned: 0,
                  activeIssues: 0,
                  resolvedIssues: 0,
                };

                return {
                  _id: id,
                  name: worker.name,
                  email: worker.email,
                  designation: worker.designation || null,
                  department: worker.department || null,
                  academicDepartment: worker.academicDepartment || null,
                  serviceDepartment: worker.serviceDepartment || null,
                  totalAssigned: workerLoad.totalAssigned,
                  activeIssues: workerLoad.activeIssues,
                  resolvedIssues: workerLoad.resolvedIssues,
                  availability:
                    workerLoad.activeIssues >= 6
                      ? "Overloaded"
                      : workerLoad.activeIssues >= 3
                        ? "Moderate"
                        : "Available",
                };
              })
              .sort((a, b) => {
                if (b.activeIssues !== a.activeIssues) return b.activeIssues - a.activeIssues;
                return a.name.localeCompare(b.name);
              })
              .slice(0, 25);
          })()
        : Promise.resolve([]);

      const [issues, reportRows, workers] = await Promise.all([
        issuesPromise,
        reportsPromise,
        workersPromise,
      ]);

      const [feedbackRows, statusDistribution, priorityDistribution] = reportRows;
      const feedback = feedbackRows[0] || { averageRating: 0, total: 0 };

      return {
        issues,
        workers,
        reports: {
          feedback: {
            averageRating: toNumber((feedback as { averageRating?: number }).averageRating),
            total: toNumber((feedback as { total?: number }).total),
          },
          statusDistribution: statusDistribution.map((row) => ({
            _id: String((row as { _id?: string })._id || "Unknown"),
            count: toNumber((row as { count?: number }).count),
          })),
          priorityDistribution: priorityDistribution.map((row) => ({
            _id: String((row as { _id?: string })._id || "Unspecified"),
            count: toNumber((row as { count?: number }).count),
          })),
        },
        stats,
      };
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    console.error("Dashboard data API error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
