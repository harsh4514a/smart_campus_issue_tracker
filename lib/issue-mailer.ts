import User from "@/models/User";
import { transporter } from "@/lib/mailer";

type EmailEvent = "created" | "assigned" | "status_changed" | "resolved" | "overdue" | "feedback_request";

type IssueMailPayload = {
  event: EmailEvent;
  to: string[];
  issue: {
    id: string;
    title: string;
    department?: string | null;
    priority?: string | null;
    status?: string | null;
  };
  actorName?: string;
};

type RecipientUser = {
  email?: string;
  role?: "student" | "faculty" | "staff" | "admin";
  adminRole?: "super_admin" | "dept_admin" | "worker" | null;
  emailNotificationsEnabled?: boolean;
  isDemoUser?: boolean;
};

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const USER_FACING_EVENTS: EmailEvent[] = ["status_changed", "resolved", "feedback_request"];

function buildSubject(event: EmailEvent, title: string) {
  if (event === "created") return `CampusTracker: New issue reported - ${title}`;
  if (event === "assigned") return `CampusTracker: Issue assigned - ${title}`;
  if (event === "status_changed") return `CampusTracker: Issue status updated - ${title}`;
  if (event === "resolved") return `CampusTracker: Issue resolved - ${title}`;
  if (event === "overdue") return `CampusTracker: Overdue issue alert - ${title}`;
  return `CampusTracker: Feedback requested - ${title}`;
}

function buildIssuePathForRecipient(issueId: string, recipient: RecipientUser) {
  if (recipient.role === "admin") {
    if (recipient.adminRole === "dept_admin") {
      return `/dept-admin/issues?issueId=${encodeURIComponent(issueId)}`;
    }
    return `/admin/issues?issueId=${encodeURIComponent(issueId)}`;
  }

  if (recipient.role === "staff") {
    return `/staff/issues/${encodeURIComponent(issueId)}`;
  }

  return `/student/my-issues?issueId=${encodeURIComponent(issueId)}`;
}

function buildLoginUrlForRecipient(issuePath: string, recipient: RecipientUser, event: EmailEvent) {
  const loginPath =
    USER_FACING_EVENTS.includes(event) || recipient.role !== "admin" ? "/login" : "/admin/login";
  return `${APP_URL}${loginPath}?redirect=${encodeURIComponent(issuePath)}`;
}

function buildHtml(payload: IssueMailPayload, issueUrl: string) {

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #065f46; color: #ffffff; padding: 16px 20px;">
        <h2 style="margin:0; font-size: 18px;">CampusTracker</h2>
        <p style="margin:4px 0 0; opacity: .9;">Smart Campus Issue Tracker</p>
      </div>
      <div style="padding: 20px;">
        <p style="margin-top: 0;"><strong>Event:</strong> ${payload.event.replaceAll("_", " ")}</p>
        <p><strong>Issue:</strong> ${payload.issue.title}</p>
        <p><strong>Department:</strong> ${payload.issue.department || "-"}</p>
        <p><strong>Priority:</strong> ${payload.issue.priority || "-"}</p>
        <p><strong>Status:</strong> ${payload.issue.status || "-"}</p>
        ${payload.actorName ? `<p><strong>Updated by:</strong> ${payload.actorName}</p>` : ""}
        <p style="margin-top: 16px;"><a href="${issueUrl}" style="background:#0d9488;color:white;text-decoration:none;padding:10px 14px;border-radius:8px;display:inline-block;">View Issue</a></p>
      </div>
      <div style="padding: 12px 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Smart Campus Issue Tracker
      </div>
    </div>
  `;
}

export async function sendIssueEventEmail(payload: IssueMailPayload) {
  if (!FROM || payload.to.length === 0) return;

  const users = await User.find({ email: { $in: payload.to } })
    .select("email role adminRole emailNotificationsEnabled isDemoUser")
    .lean();

  const recipients = (users as RecipientUser[]).filter(
    (user) => user.emailNotificationsEnabled !== false && user.isDemoUser !== true && Boolean(user.email)
  );

  if (recipients.length === 0) return;

  await Promise.all(
    recipients.map(async (recipient) => {
      const issuePath = USER_FACING_EVENTS.includes(payload.event)
        ? `/student/my-issues?issueId=${encodeURIComponent(payload.issue.id)}`
        : buildIssuePathForRecipient(payload.issue.id, recipient);
      const issueUrl = buildLoginUrlForRecipient(issuePath, recipient, payload.event);
      await transporter.sendMail({
        from: FROM,
        to: recipient.email,
        subject: buildSubject(payload.event, payload.issue.title),
        html: buildHtml(payload, issueUrl),
        text: `CampusTracker notification: ${payload.issue.title} (${payload.event})`,
      });
    })
  );
}

export async function getAdminRecipientEmails() {
  const admins = await User.find({ role: "admin" }).select("email emailNotificationsEnabled isDemoUser").lean();
  return admins
    .filter((admin) => admin.emailNotificationsEnabled !== false && admin.isDemoUser !== true)
    .map((admin) => admin.email)
    .filter((email): email is string => Boolean(email));
}
