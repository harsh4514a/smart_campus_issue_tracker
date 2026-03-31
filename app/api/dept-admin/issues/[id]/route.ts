import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import AuditLog from "@/models/AuditLog";
import { canDeptAdminAccessIssue, requireDeptAdmin } from "@/lib/dept-admin";
import { createAuditLog } from "@/lib/audit";
import { deleteFromCacheByPrefix } from "@/lib/server-cache";

type RouteContext = { params: Promise<{ id: string }> };
const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
type AllowedPriority = (typeof ALLOWED_PRIORITIES)[number];

export async function GET(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  const issue = await Issue.findById(id)
    .populate("student", "name email")
    .populate("department", "name type")
    .populate("academicDepartment", "name type")
    .populate("serviceDepartment", "name type")
    .populate("assignedStaff", "name email")
    .lean();

  if (!issue) {
    return NextResponse.json({ message: "Issue not found." }, { status: 404 });
  }

  if (!canDeptAdminAccessIssue(auth.user, issue)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const logs = await AuditLog.find({ issueId: issue._id })
    .sort({ timestamp: -1 })
    .select("_id action performedBy oldValue newValue timestamp")
    .lean();

  return NextResponse.json({ issue, logs });
}

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const rawPriority = String(body?.priority || "").trim();

    if (!ALLOWED_PRIORITIES.includes(rawPriority as AllowedPriority)) {
      return NextResponse.json({ message: "Invalid priority." }, { status: 400 });
    }

    const issue = await Issue.findById(id).lean();
    if (!issue) {
      return NextResponse.json({ message: "Issue not found." }, { status: 404 });
    }

    if (!canDeptAdminAccessIssue(auth.user, issue)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (!issue.status || !["Pending", "In Progress"].includes(issue.status)) {
      return NextResponse.json(
        { message: "Priority can be changed only for Pending or In Progress issues." },
        { status: 400 }
      );
    }

    const targetPriority = rawPriority as AllowedPriority;
    const oldPriority = (issue.priority || "Medium") as AllowedPriority;

    if (oldPriority === targetPriority) {
      const unchangedIssue = await Issue.findById(issue._id)
        .populate("student", "name email")
        .populate("department", "name type")
        .populate("academicDepartment", "name type")
        .populate("serviceDepartment", "name type")
        .populate("assignedStaff", "name email")
        .lean();

      return NextResponse.json({ message: `Priority updated to ${targetPriority}`, issue: unchangedIssue });
    }

    await Issue.updateOne(
      { _id: issue._id },
      {
        $set: {
          priority: targetPriority,
        },
      }
    );

    await createAuditLog({
      issueId: issue._id,
      action: "Priority changed",
      performedBy: {
        userId: auth.user._id,
        name: auth.user.name,
        role: auth.user.role,
      },
      oldValue: {
        old_priority: oldPriority,
      },
      newValue: {
        new_priority: targetPriority,
        changed_by: auth.user.name,
        timestamp: new Date().toISOString(),
      },
    });

    const updatedIssue = await Issue.findById(issue._id)
      .populate("student", "name email")
      .populate("department", "name type")
      .populate("academicDepartment", "name type")
      .populate("serviceDepartment", "name type")
      .populate("assignedStaff", "name email")
      .lean();

    deleteFromCacheByPrefix("dept-admin:dashboard:");
    deleteFromCacheByPrefix("dept-admin:workers:");

    return NextResponse.json({ message: `Priority updated to ${targetPriority}`, issue: updatedIssue });
  } catch (error) {
    console.error("Update priority error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const issue = await Issue.findById(id).select("_id status department academicDepartment serviceDepartment").lean();

  if (!issue) {
    return NextResponse.json({ message: "Issue not found." }, { status: 404 });
  }

  if (!canDeptAdminAccessIssue(auth.user, issue)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await Issue.deleteOne({ _id: issue._id });
  await AuditLog.deleteMany({ issueId: issue._id });

  deleteFromCacheByPrefix("dept-admin:dashboard:");
  deleteFromCacheByPrefix("dept-admin:workers:");

  return NextResponse.json({ message: "Issue deleted successfully." });
}
