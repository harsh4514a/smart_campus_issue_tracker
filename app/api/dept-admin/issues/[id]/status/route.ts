import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import { canDeptAdminAccessIssue, requireDeptAdmin } from "@/lib/dept-admin";
import { createAuditLog } from "@/lib/audit";
import { deleteFromCacheByPrefix } from "@/lib/server-cache";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved", "Rejected"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const { status, note } = await request.json();

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ message: "Invalid status transition." }, { status: 400 });
  }

  const issue = await Issue.findById(id).lean();
  if (!issue) {
    return NextResponse.json({ message: "Issue not found." }, { status: 404 });
  }

  if (!canDeptAdminAccessIssue(auth.user, issue)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (issue.status === "Resolved" || issue.status === "Rejected") {
    return NextResponse.json({ message: "Closed issue cannot be modified." }, { status: 400 });
  }

  const targetStatus = status as AllowedStatus;

  if (targetStatus === "In Progress") {
    if (!issue.assignedStaff) {
      return NextResponse.json({ message: "Assign a worker before moving to In Progress." }, { status: 400 });
    }

    if (issue.status !== "Pending" && issue.status !== "In Progress") {
      return NextResponse.json({ message: "Workflow violation. Pending -> In Progress only." }, { status: 400 });
    }
  }

  if (targetStatus === "Resolved") {
    if (issue.status !== "In Progress") {
      return NextResponse.json({ message: "Workflow violation. In Progress -> Resolved only." }, { status: 400 });
    }
  }

  await Issue.updateOne({ _id: issue._id }, { $set: { status: targetStatus } });

  await createAuditLog({
    issueId: issue._id,
    action: "Status changed",
    performedBy: {
      userId: auth.user._id,
      name: auth.user.name,
      role: auth.user.role,
    },
    oldValue: {
      status: issue.status,
    },
    newValue: {
      status: targetStatus,
      note: typeof note === "string" ? note.trim() : "",
    },
  });

  const updatedIssue = await Issue.findById(issue._id)
    .populate("student", "name email")
    .populate("assignedStaff", "name email")
    .populate("department", "name type")
    .populate("academicDepartment", "name type")
    .populate("serviceDepartment", "name type")
    .lean();

  deleteFromCacheByPrefix("dept-admin:dashboard:");
  deleteFromCacheByPrefix("dept-admin:workers:");

  return NextResponse.json({ message: "Status updated successfully.", issue: updatedIssue });
}
