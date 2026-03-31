import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import User from "@/models/User";
import Issue from "@/models/Issue";
import Department from "@/models/Department";
import { getDepartmentScopedIssueFilter } from "@/lib/rbac";

export async function GET(request: Request) {
  await connectDB();

  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const issueScopeFilter = getDepartmentScopedIssueFilter(auth.user);

    const [
      studentCount,
      facultyCount,
      staffCount,
      deptCount,
      issueCount,
      pendingCount,
      inProgressCount,
      resolvedCount,
      assignedCount,
      unassignedCount,
      overdueCount,
      pendingCurrentMonth,
      pendingPreviousMonth,
      resolvedCurrentMonth,
      resolvedPreviousMonth,
      recurringCount,
      issuesForDepartment,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "faculty" }),
      User.countDocuments({ role: "staff" }),
      Department.countDocuments({}),
      Issue.countDocuments(issueScopeFilter),
      Issue.countDocuments({ ...issueScopeFilter, status: "Pending" }),
      Issue.countDocuments({ ...issueScopeFilter, status: "In Progress" }),
      Issue.countDocuments({ ...issueScopeFilter, status: "Resolved" }),
      Issue.countDocuments({
        ...issueScopeFilter,
        assignedStaff: { $ne: null },
        status: { $in: ["Pending", "In Progress"] },
      }),
      Issue.countDocuments({ ...issueScopeFilter, assignedStaff: null }),
      Issue.countDocuments({
        ...issueScopeFilter,
        status: { $nin: ["Resolved", "Rejected"] },
        dueDate: { $lt: now },
      }),
      Issue.countDocuments({
        ...issueScopeFilter,
        status: "Pending",
        createdAt: { $gte: startOfCurrentMonth },
      }),
      Issue.countDocuments({
        ...issueScopeFilter,
        status: "Pending",
        createdAt: { $gte: startOfPreviousMonth, $lt: startOfCurrentMonth },
      }),
      Issue.countDocuments({
        ...issueScopeFilter,
        status: "Resolved",
        createdAt: { $gte: startOfCurrentMonth },
      }),
      Issue.countDocuments({
        ...issueScopeFilter,
        status: "Resolved",
        createdAt: { $gte: startOfPreviousMonth, $lt: startOfCurrentMonth },
      }),
      Issue.countDocuments({ ...issueScopeFilter, recurring: true }),
      Issue.find(issueScopeFilter, "department academicDepartment serviceDepartment")
        .populate("department", "name")
        .populate("academicDepartment", "name")
        .populate("serviceDepartment", "name")
        .lean(),
    ]);

    const departmentCounts = new Map<string, number>();
    for (const issue of issuesForDepartment) {
      const serviceName =
        issue.serviceDepartment && typeof issue.serviceDepartment === "object" && "name" in issue.serviceDepartment
          ? String(issue.serviceDepartment.name || "")
          : "";
      const academicName =
        issue.academicDepartment && typeof issue.academicDepartment === "object" && "name" in issue.academicDepartment
          ? String(issue.academicDepartment.name || "")
          : "";
      const legacyName =
        issue.department && typeof issue.department === "object" && "name" in issue.department
          ? String(issue.department.name || "")
          : "";

      const departmentName = serviceName || academicName || legacyName || "Unassigned";
      departmentCounts.set(departmentName, (departmentCounts.get(departmentName) || 0) + 1);
    }

    const topDepartment = Array.from(departmentCounts.entries()).sort((a, b) => b[1] - a[1])[0];

    const getTrendDirection = (current: number, previous: number) => {
      if (current > previous) return "up" as const;
      if (current < previous) return "down" as const;
      return "flat" as const;
    };

    return NextResponse.json({
      students: studentCount,
      faculty: facultyCount,
      staff: staffCount,
      departments: deptCount,
      issues: issueCount,
      pending: pendingCount,
      inProgress: inProgressCount,
      assigned: assignedCount,
      resolved: resolvedCount,
      needsAttention: {
        unassigned: unassignedCount,
        overdue: overdueCount,
        recurring: recurringCount,
      },
      insights: {
        topDepartment: topDepartment
          ? {
              name: topDepartment[0],
              count: topDepartment[1],
            }
          : null,
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
    });
  } catch (error) {
    console.error("Admin stats error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}