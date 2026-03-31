import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import AuditLog from "@/models/AuditLog";
import { buildDepartmentScopeFilter, requireDeptAdmin } from "@/lib/dept-admin";

export async function GET(request: Request) {
  try {
    await connectDB();
    const auth = await requireDeptAdmin(request);
    if (auth instanceof Response) return auth;

    const params = new URL(request.url).searchParams;
    const departmentId = params.get("departmentId");

    const issueScope = buildDepartmentScopeFilter(auth.departmentIds, departmentId);
    const issues = await Issue.find(issueScope).select("_id title").lean();
    const issueIds = issues.map((issue) => issue._id);

    if (issueIds.length === 0) {
      return NextResponse.json({ notifications: [] });
    }

    const issueTitleMap = new Map(issues.map((issue) => [String(issue._id), issue.title]));

    const logs = await AuditLog.find({
      issueId: { $in: issueIds },
      action: { $in: ["Assigned to worker", "Status changed", "Issue created"] },
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .select("_id issueId action timestamp performedBy")
      .lean();

    const notifications = logs.map((log) => ({
      _id: String(log._id),
      issueId: String(log.issueId),
      issueTitle: issueTitleMap.get(String(log.issueId)) || "Issue",
      action: log.action,
      actorName: log.performedBy?.name || "System",
      timestamp: log.timestamp,
    }));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.warn("dept-admin notifications unavailable:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ notifications: [], degraded: true });
  }
}
