import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import Issue from "@/models/Issue";
import { createAuditLog } from "@/lib/audit";
import { sendIssueEventEmail } from "@/lib/issue-mailer";
import { canAdminAccessIssue } from "@/lib/rbac";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  await connectDB();
  const auth = await authenticateRequest(request, ["faculty", "staff", "admin"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const { status, resolutionAttachments } = await request.json();
    if (!status || !["Pending", "In Progress", "Resolved", "Rejected"].includes(status)) {
      return NextResponse.json({ message: "Invalid status." }, { status: 400 });
    }

    if (status === "Rejected" && auth.user.role !== "admin") {
      return NextResponse.json({ message: "Only admins can reject issues." }, { status: 403 });
    }

    const issue = await Issue.findById(id)
      .populate("student", "name email")
      .populate("department", "name")
      .populate("academicDepartment", "name")
      .populate("serviceDepartment", "name");
    if (!issue) return NextResponse.json({ message: "Issue not found." }, { status: 404 });

    if (auth.user.role === "admin" && !canAdminAccessIssue(auth.user, issue)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (auth.user.role !== "admin" && String(issue.assignedStaff || "") !== String(auth.user._id)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const oldStatus = issue.status;
    issue.status = status;
    if (Array.isArray(resolutionAttachments)) {
      issue.resolutionAttachments = resolutionAttachments.filter((item) => typeof item === "string");
    }
    await issue.save();

    await createAuditLog({
      issueId: issue._id,
      action: "Status changed",
      performedBy: {
        userId: auth.user._id,
        name: auth.user.name,
        role: auth.user.role,
      },
      oldValue: { status: oldStatus },
      newValue: { status },
    });

    const studentEmail = (issue.student as { email?: string } | null)?.email;
    if (studentEmail) {
      try {
        await sendIssueEventEmail({
          event: status === "Resolved" ? "resolved" : "status_changed",
          to: [studentEmail],
          issue: {
            id: String(issue._id),
            title: issue.title,
            department:
              (issue.serviceDepartment as { name?: string } | null)?.name ||
              (issue.academicDepartment as { name?: string } | null)?.name ||
              (issue.department as { name?: string } | null)?.name ||
              null,
            priority: issue.priority,
            status,
          },
          actorName: auth.user.name,
        });

        if (status === "Resolved") {
          await sendIssueEventEmail({
            event: "feedback_request",
            to: [studentEmail],
            issue: {
              id: String(issue._id),
              title: issue.title,
              department:
                (issue.serviceDepartment as { name?: string } | null)?.name ||
                (issue.academicDepartment as { name?: string } | null)?.name ||
                (issue.department as { name?: string } | null)?.name ||
                null,
              priority: issue.priority,
              status,
            },
            actorName: auth.user.name,
          });
        }
      } catch (mailErr) {
        console.error("Status email error", mailErr);
      }
    }

    return NextResponse.json({ message: "Status updated", issue });
  } catch (error) {
    console.error("Update status error", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}