import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { buildDepartmentScopeFilter, requireDeptAdmin } from "@/lib/dept-admin";

export async function GET(request: Request) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const departmentId = params.get("departmentId");
  const category = (params.get("category") || "").trim();
  const from = params.get("from");
  const to = params.get("to");
  const format = params.get("format");

  if (from && Number.isNaN(new Date(from).getTime())) {
    return NextResponse.json({ message: "Invalid 'from' date." }, { status: 400 });
  }

  if (to && Number.isNaN(new Date(to).getTime())) {
    return NextResponse.json({ message: "Invalid 'to' date." }, { status: 400 });
  }

  if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
    return NextResponse.json({ message: "'from' date cannot be after 'to' date." }, { status: 400 });
  }

  const filter: Record<string, unknown> = {
    ...buildDepartmentScopeFilter(auth.departmentIds, departmentId),
  };

  const optionsFilter: Record<string, unknown> = {
    ...buildDepartmentScopeFilter(auth.departmentIds, departmentId),
  };

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    filter.createdAt = range;
    optionsFilter.createdAt = range;
  }

  if (category && category.toLowerCase() !== "all") {
    filter.category = category;
  }

  const [
    total,
    resolved,
    unassigned,
    highPriorityPending,
    overdue,
    priorityRows,
    statusRows,
    createdTrendRows,
    resolvedTrendRows,
    workers,
    scopedCategories,
    scopedDepartments,
  ] = await Promise.all([
    Issue.countDocuments(filter),
    Issue.countDocuments({ ...filter, status: "Resolved" }),
    Issue.countDocuments({ ...filter, assignedStaff: null, status: { $nin: ["Resolved", "Rejected"] } }),
    Issue.countDocuments({ ...filter, status: "Pending", priority: { $in: ["High", "Urgent"] } }),
    Issue.countDocuments({ ...filter, status: { $nin: ["Resolved", "Rejected"] }, dueDate: { $lt: new Date() } }),
    Issue.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Issue.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Issue.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Issue.aggregate([
      { $match: { ...filter, status: "Resolved" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Issue.aggregate([
      { $match: { ...filter, assignedStaff: { $ne: null } } },
      {
        $group: {
          _id: "$assignedStaff",
          total: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0],
            },
          },
          pending: {
            $sum: {
              $cond: [{ $in: ["$status", ["Pending", "In Progress"]] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "worker",
        },
      },
      { $unwind: "$worker" },
      {
        $project: {
          _id: 0,
          workerId: "$worker._id",
          name: "$worker.name",
          email: "$worker.email",
          total: 1,
          resolved: 1,
          pending: 1,
        },
      },
      { $sort: { total: -1 } },
    ]),
    Issue.distinct("category", optionsFilter),
    Department.find({ _id: { $in: auth.departmentIds } }).select("_id name type").sort({ name: 1 }).lean(),
  ]);

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [currentMonthRaised, previousMonthRaised, currentMonthResolved, previousMonthResolved, topCategoryRow] =
    await Promise.all([
      Issue.countDocuments({ ...filter, createdAt: { $gte: currentMonthStart } }),
      Issue.countDocuments({ ...filter, createdAt: { $gte: previousMonthStart, $lt: currentMonthStart } }),
      Issue.countDocuments({ ...filter, status: "Resolved", updatedAt: { $gte: currentMonthStart } }),
      Issue.countDocuments({
        ...filter,
        status: "Resolved",
        updatedAt: { $gte: previousMonthStart, $lt: currentMonthStart },
      }),
      Issue.aggregate([
        { $match: filter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

  const departmentRows = await Issue.aggregate([
    {
      $match: {
        ...filter,
        $or: [{ academicDepartment: { $ne: null } }, { serviceDepartment: { $ne: null } }, { department: { $ne: null } }],
      },
    },
    {
      $project: {
        departmentId: {
          $ifNull: ["$academicDepartment", { $ifNull: ["$serviceDepartment", "$department"] }],
        },
      },
    },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  const topDepartmentId = departmentRows[0]?._id ? String(departmentRows[0]._id) : null;
  const topDepartment = topDepartmentId ? await Department.findById(topDepartmentId).select("name").lean() : null;

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : null;

  const resolvedIssues = await Issue.find({ ...filter, status: "Resolved", dueDate: { $ne: null } })
    .select("createdAt dueDate")
    .lean();

  const slaMetCount = resolvedIssues.filter((issue) => {
    if (!issue.dueDate) return false;
    return new Date(issue.createdAt).getTime() <= new Date(issue.dueDate).getTime();
  }).length;
  const slaCompliance = resolvedIssues.length > 0 ? Math.round((slaMetCount / resolvedIssues.length) * 100) : 0;

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

  const basePriorityTiers = ["Low", "Medium", "High", "Urgent"];
  const priorityCountMap = new Map<string, number>(
    priorityRows.map((row) => [
      String((row as { _id?: string | null })._id || "None"),
      Number((row as { count?: number }).count || 0),
    ])
  );

  const priorityDistribution = basePriorityTiers.map((tier) => {
    const count = priorityCountMap.get(tier) || 0;
    return {
      priority: tier,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  const workerPerformance = workers.map((worker) => {
    const totalAssigned = Number((worker as { total?: number }).total || 0);
    const totalResolved = Number((worker as { resolved?: number }).resolved || 0);
    return {
      workerId: String((worker as { workerId?: unknown }).workerId || ""),
      name: String((worker as { name?: string }).name || "Unknown"),
      email: String((worker as { email?: string }).email || ""),
      total: totalAssigned,
      resolved: totalResolved,
      pending: Number((worker as { pending?: number }).pending || 0),
      resolutionRate: totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : null,
    };
  });

  const payload = {
    metrics: {
      total,
      resolutionRate,
      slaCompliance,
      unassigned,
    },
    alerts: {
      unassigned,
      highPriorityPending,
      overdue,
    },
    insights: {
      topIssueCategory: topCategoryRow[0]?._id || "N/A",
      mostActiveDepartment: topDepartment?.name || "N/A",
    },
    monthlyComparison: {
      raised: {
        current: currentMonthRaised,
        previous: previousMonthRaised,
        delta: currentMonthRaised - previousMonthRaised,
      },
      resolved: {
        current: currentMonthResolved,
        previous: previousMonthResolved,
        delta: currentMonthResolved - previousMonthResolved,
      },
    },
    trend,
    priorityDistribution,
    statusDistribution: statusRows,
    workerPerformance,
    departments: scopedDepartments,
    categories: (scopedCategories as string[])
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .sort((a, b) => a.localeCompare(b)),
  };

  if (format === "csv") {
    const rows = [
      ["Metric", "Value"],
      ["Total Issues", String(payload.metrics.total)],
      ["Resolution Rate (%)", payload.metrics.resolutionRate === null ? "N/A" : String(payload.metrics.resolutionRate)],
      ["SLA Compliance (%)", String(payload.metrics.slaCompliance)],
      ["Unassigned Issues", String(payload.metrics.unassigned)],
      ["High Priority Pending", String(payload.alerts.highPriorityPending)],
      ["Overdue Issues", String(payload.alerts.overdue)],
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=dept-admin-report-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  }

  return NextResponse.json(payload);
}
