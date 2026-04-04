import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import User from "@/models/User";
import { canDeptAdminAccessIssue, requireDeptAdmin } from "@/lib/dept-admin";
import { createAuditLog } from "@/lib/audit";
import { deleteFromCacheByPrefix } from "@/lib/server-cache";
import { sendIssueEventEmail } from "@/lib/issue-mailer";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  await connectDB();
  const auth = await requireDeptAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const { staffId } = await request.json();

  if (!staffId || typeof staffId !== "string") {
    return NextResponse.json({ message: "staffId is required." }, { status: 400 });
  }

  const issue = await Issue.findById(id).lean();
  if (!issue) {
    return NextResponse.json({ message: "Issue not found." }, { status: 404 });
  }

  if (!canDeptAdminAccessIssue(auth.user, issue)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (issue.status === "Resolved") {
    return NextResponse.json({ message: "Resolved issue cannot be reassigned." }, { status: 400 });
  }

  const staff = await User.findOne({ _id: staffId, role: "staff" }).lean();
  if (!staff) {
    return NextResponse.json({ message: "Worker not found." }, { status: 404 });
  }

  const issueDepartmentIds = [issue.department, issue.academicDepartment, issue.serviceDepartment]
    .map((value) => String(value || ""))
    .filter(Boolean);

  const staffDepartmentIds = [staff.department, staff.academicDepartment, staff.serviceDepartment]
    .map((value) => String(value || ""))
    .filter(Boolean);

  const sameDepartment = issueDepartmentIds.some((departmentId) => staffDepartmentIds.includes(departmentId));
  if (!sameDepartment) {
    return NextResponse.json(
      { message: "Worker must belong to the same department as the issue." },
      { status: 400 }
    );
  }

  await Issue.updateOne(
    { _id: issue._id },
    {
      $set: {
        assignedStaff: staff._id,
        ...(issue.status === "Pending" ? { status: "In Progress" } : {}),
      },
    }
  );

  await createAuditLog({
    issueId: issue._id,
    action: "Assigned to worker",
    performedBy: {
      userId: auth.user._id,
      name: auth.user.name,
      role: auth.user.role,
    },
    oldValue: {
      assignedStaff: issue.assignedStaff ? String(issue.assignedStaff) : null,
    },
    newValue: {
      assignedStaff: staff.name,
      ...(issue.status === "Pending" ? { status: "In Progress" } : {}),
    },
  });

  const updatedIssue = await Issue.findById(issue._id)
    .populate("student", "name email")
    .populate("assignedStaff", "name email")
    .populate("department", "name type")
    .populate("academicDepartment", "name type")
    .populate("serviceDepartment", "name type")
    .lean();

  try {
    if (staff.email) {
      await sendIssueEventEmail({
        event: "assigned",
        to: [staff.email],
        issue: {
          id: String(issue._id),
          title: issue.title,
          department:
            (updatedIssue?.serviceDepartment as { name?: string } | null)?.name ||
            (updatedIssue?.academicDepartment as { name?: string } | null)?.name ||
            (updatedIssue?.department as { name?: string } | null)?.name ||
            null,
          priority: updatedIssue?.priority,
          status: updatedIssue?.status,
        },
        actorName: auth.user.name,
      });
    }
  } catch (mailErr) {
    console.error("Dept-admin assign email error", mailErr);
  }

  deleteFromCacheByPrefix("dept-admin:dashboard:");
  deleteFromCacheByPrefix("dept-admin:workers:");
  deleteFromCacheByPrefix("dept-admin:notifications:");
  deleteFromCacheByPrefix("dept-admin:issues:");
  deleteFromCacheByPrefix("dept-admin:reports:");

  return NextResponse.json({ message: "Issue assigned successfully.", issue: updatedIssue });
}
