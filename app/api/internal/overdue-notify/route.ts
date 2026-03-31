import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Issue from "@/models/Issue";
import { getAdminRecipientEmails, sendIssueEventEmail } from "@/lib/issue-mailer";

export async function POST() {
  await connectDB();

  const now = new Date();
  const overdueIssues = await Issue.find({
    status: { $nin: ["Resolved", "Rejected"] },
    dueDate: { $lt: now },
    $or: [{ overdueNotifiedAt: null }, { overdueNotifiedAt: { $exists: false } }],
  })
    .populate("assignedStaff", "email")
    .populate("department", "name")
    .populate("academicDepartment", "name")
    .populate("serviceDepartment", "name")
    .select("title dueDate assignedStaff department academicDepartment serviceDepartment priority status");

  const admins = await getAdminRecipientEmails();

  for (const issue of overdueIssues) {
    const assignedEmail = (issue.assignedStaff as { email?: string } | null)?.email;
    const recipients = assignedEmail ? [...admins, assignedEmail] : admins;

    await sendIssueEventEmail({
      event: "overdue",
      to: recipients,
      issue: {
        id: String(issue._id),
        title: issue.title,
        department:
          (issue.serviceDepartment as { name?: string } | null)?.name ||
          (issue.academicDepartment as { name?: string } | null)?.name ||
          (issue.department as { name?: string } | null)?.name ||
          null,
        priority: issue.priority,
        status: issue.status,
      },
    });

    issue.overdueNotifiedAt = new Date();
    await issue.save();
  }

  return NextResponse.json({ notified: overdueIssues.length });
}
