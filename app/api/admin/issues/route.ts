import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import { getDepartmentScopedIssueFilter } from "@/lib/rbac";

const ISSUE_SELECT_FULL =
  "title description imageUrl attachments resolutionAttachments category status location createdAt updatedAt dueDate priority recurring student department academicDepartment serviceDepartment assignedStaff";
const ISSUE_SELECT_TRIAGE =
  "title description category status location createdAt updatedAt dueDate priority recurring student department academicDepartment serviceDepartment assignedStaff";
const ISSUE_SELECT_REPORTS =
  "title category status location createdAt updatedAt priority recurring student assignedStaff department academicDepartment serviceDepartment";
const ISSUE_SELECT_DASHBOARD =
  "title status createdAt updatedAt priority student assignedStaff";

function parsePositiveInt(raw: string | null, fallback: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
  await connectDB();
  const auth = await authenticateRequest(request, ["admin"]);
  if (auth instanceof Response) return auth;

  const issueFilter = getDepartmentScopedIssueFilter(auth.user);

  const params = new URL(request.url).searchParams;
  const requestedView = (params.get("view") || "full").trim().toLowerCase();
  const view =
    requestedView === "dashboard" || requestedView === "reports" || requestedView === "triage"
      ? requestedView
      : "full";
  const requestedLimit = parsePositiveInt(params.get("limit"), 0, 5000);

  const limit =
    view === "dashboard"
      ? requestedLimit || 120
      : view === "reports"
        ? requestedLimit || 1500
        : view === "triage"
          ? requestedLimit
        : requestedLimit;

  const selectClause =
    view === "dashboard"
      ? ISSUE_SELECT_DASHBOARD
      : view === "triage"
        ? ISSUE_SELECT_TRIAGE
      : view === "reports"
        ? ISSUE_SELECT_REPORTS
        : ISSUE_SELECT_FULL;

  let query = Issue.find(issueFilter)
    .select(selectClause)
    .populate(
      "student",
      view === "dashboard"
        ? "name"
        : view === "reports"
          ? "name email"
          : "name email department academicDepartment course"
    )
    .populate("assignedStaff", "_id name email")
    .sort({ createdAt: -1 });

  if (view !== "dashboard") {
    query = query
      .populate("department", "_id name type")
      .populate("academicDepartment", "_id name type")
      .populate("serviceDepartment", "_id name type");
  }

  if (limit > 0) {
    query = query.limit(limit);
  }

  const issues = await query.lean();

  return NextResponse.json({ issues });
}