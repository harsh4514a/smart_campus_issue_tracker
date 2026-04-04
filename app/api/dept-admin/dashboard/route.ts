import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import Department from "@/models/Department";
import { buildDepartmentScopeFilter, requireDeptAdmin } from "@/lib/dept-admin";
import { getOrSetCache } from "@/lib/server-cache";

export async function GET(request: Request) {
  try {
    await connectDB();
    const auth = await requireDeptAdmin(request);
    if (auth instanceof Response) return auth;

    const params = new URL(request.url).searchParams;
    const { departmentIds } = auth;
    const selectedDepartmentId = params.get("departmentId");
    const view = (params.get("view") || "full").trim().toLowerCase();
    const scopeFilter = buildDepartmentScopeFilter(departmentIds, selectedDepartmentId);
    const cacheKey = `dept-admin:dashboard:${view}:${auth.user._id}:${[...departmentIds].sort().join(",")}:${selectedDepartmentId || "all"}`;

    const payload = await getOrSetCache(cacheKey, 20_000, async () => {
      if (view === "summary") {
        const now = new Date();

        const [total, pending, inProgress, resolved, unassigned, overdue, highPriorityPending] = await Promise.all([
          Issue.countDocuments(scopeFilter),
          Issue.countDocuments({ ...scopeFilter, status: "Pending" }),
          Issue.countDocuments({ ...scopeFilter, status: "In Progress" }),
          Issue.countDocuments({ ...scopeFilter, status: "Resolved" }),
          Issue.countDocuments({ ...scopeFilter, assignedStaff: null }),
          Issue.countDocuments({
            ...scopeFilter,
            status: { $nin: ["Resolved", "Rejected"] },
            dueDate: { $lt: now },
          }),
          Issue.countDocuments({ ...scopeFilter, status: "Pending", priority: { $in: ["High", "Urgent"] } }),
        ]);

        return {
          kpi: { total, pending, inProgress, resolved },
          alerts: { unassigned, overdue, highPriorityPending },
        };
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const trendWindowDays = 60;
      const trendStart = new Date(now);
      trendStart.setHours(0, 0, 0, 0);
      trendStart.setDate(trendStart.getDate() - (trendWindowDays - 1));
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const [
        total,
        pending,
        inProgress,
        resolved,
        unassigned,
        overdue,
        highPriorityPending,
        createdToday,
        resolvedToday,
        resolvedPrevious7Days,
        resolvedCurrent7Days,
        createdTrendRows,
        resolvedTrendRows,
        distributionRows,
        scopedIssueIds,
        workers,
        departments,
      ] = await Promise.all([
        Issue.countDocuments(scopeFilter),
        Issue.countDocuments({ ...scopeFilter, status: "Pending" }),
        Issue.countDocuments({ ...scopeFilter, status: "In Progress" }),
        Issue.countDocuments({ ...scopeFilter, status: "Resolved" }),
        Issue.countDocuments({ ...scopeFilter, assignedStaff: null }),
        Issue.countDocuments({
          ...scopeFilter,
          status: { $nin: ["Resolved", "Rejected"] },
          dueDate: { $lt: now },
        }),
        Issue.countDocuments({ ...scopeFilter, status: "Pending", priority: { $in: ["High", "Urgent"] } }),
        Issue.countDocuments({ ...scopeFilter, createdAt: { $gte: startOfToday } }),
        Issue.countDocuments({ ...scopeFilter, status: "Resolved", updatedAt: { $gte: startOfToday } }),
        Issue.countDocuments({
          ...scopeFilter,
          status: "Resolved",
          updatedAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
        }),
        Issue.countDocuments({
          ...scopeFilter,
          status: "Resolved",
          updatedAt: { $gte: sevenDaysAgo },
        }),
        Issue.aggregate([
          { $match: { ...scopeFilter, createdAt: { $gte: trendStart } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Issue.aggregate([
          { $match: { ...scopeFilter, status: "Resolved", updatedAt: { $gte: trendStart } } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Issue.aggregate([
          { $match: scopeFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Issue.find(scopeFilter).select("_id assignedStaff").sort({ updatedAt: -1 }).limit(200).lean(),
        User.find({ role: "staff", $or: [{ department: { $in: departmentIds } }, { academicDepartment: { $in: departmentIds } }, { serviceDepartment: { $in: departmentIds } }] })
          .select("_id name email")
          .lean(),
        Department.find({ _id: { $in: departmentIds } }).select("_id name type").sort({ name: 1 }).lean(),
      ]);

      const issueIds = scopedIssueIds.map((row) => row._id);
      const recentActivity = issueIds.length
        ? await AuditLog.find({ issueId: { $in: issueIds } })
          .sort({ timestamp: -1 })
          .limit(5)
          .select("_id issueId action timestamp performedBy newValue")
          .lean()
        : [];

      const issueTitles = issueIds.length
        ? await Issue.find({ _id: { $in: issueIds } }).select("_id title status dueDate priority").lean()
        : [];

      const titleMap = new Map(issueTitles.map((issue) => [String(issue._id), issue]));

      const criticalIssues = issueTitles
        .filter((issue) => {
          if (issue.status === "Resolved" || issue.status === "Rejected") return false;
          const isHighPriority = issue.priority === "High" || issue.priority === "Urgent";
          const isOverdueIssue = Boolean(issue.dueDate && new Date(issue.dueDate).getTime() < now.getTime());
          return isHighPriority || isOverdueIssue;
        })
        .sort((a, b) => {
          const aOverdue = a.dueDate ? new Date(a.dueDate).getTime() < now.getTime() : false;
          const bOverdue = b.dueDate ? new Date(b.dueDate).getTime() < now.getTime() : false;
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
          return String(b.priority || "").localeCompare(String(a.priority || ""));
        })
        .slice(0, 8)
        .map((issue) => ({
          _id: String(issue._id),
          title: issue.title,
          priority: issue.priority || "Medium",
          dueDate: issue.dueDate || null,
          status: issue.status,
          overdue: Boolean(issue.dueDate && new Date(issue.dueDate).getTime() < now.getTime()),
        }));

      const workerLoad = new Map<string, number>();
      for (const item of scopedIssueIds) {
        const assignedStaff = item.assignedStaff ? String(item.assignedStaff) : "";
        if (!assignedStaff) continue;
        workerLoad.set(assignedStaff, (workerLoad.get(assignedStaff) || 0) + 1);
      }

      const workerSummary = workers.map((worker) => {
        const activeTasks = workerLoad.get(String(worker._id)) || 0;
        const availability = activeTasks >= 6 ? "Overloaded" : activeTasks >= 3 ? "Moderate" : "Available";
        return {
          _id: String(worker._id),
          name: worker.name,
          email: worker.email,
          activeTasks,
          availability,
        };
      });

      const insightDelta = resolvedCurrent7Days - resolvedPrevious7Days;
      const smartInsight =
        insightDelta < 0
          ? `Resolution throughput dropped by ${Math.abs(insightDelta)} over the last 7 days.`
          : insightDelta > 0
            ? `Resolution throughput improved by ${insightDelta} over the last 7 days.`
            : "Resolution throughput is stable compared with the previous 7 days.";

      const createdMap = new Map(
        createdTrendRows.map((row) => [String(row._id), Number((row as { count?: number }).count || 0)])
      );
      const resolvedMap = new Map(
        resolvedTrendRows.map((row) => [String(row._id), Number((row as { count?: number }).count || 0)])
      );
      const trendDates = Array.from(new Set([...createdMap.keys(), ...resolvedMap.keys()])).sort();
      const trend = trendDates.map((date) => ({
        date,
        created: createdMap.get(date) || 0,
        resolved: resolvedMap.get(date) || 0,
      }));

      return {
        kpi: { total, pending, inProgress, resolved },
        alerts: { unassigned, overdue, highPriorityPending },
        todaySummary: { created: createdToday, resolved: resolvedToday },
        smartInsight,
        recentActivity: recentActivity.map((log) => {
          const issue = titleMap.get(String(log.issueId));
          return {
            _id: String(log._id),
            issueId: String(log.issueId),
            issueTitle: issue?.title || "Issue",
            action: log.action,
            timestamp: log.timestamp,
            performedBy: log.performedBy,
            newValue: log.newValue || null,
          };
        }),
        criticalIssues,
        workerSummary,
        trend,
        distribution: distributionRows,
        departments,
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Dept admin dashboard error", error);
    return NextResponse.json({ message: "Failed to load dept-admin dashboard." }, { status: 500 });
  }
}
