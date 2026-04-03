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
  department?: unknown;
  academicDepartment?: unknown;
  serviceDepartment?: unknown;
  managedDepartments?: unknown[];
  isActive?: boolean;
  emailNotificationsEnabled?: boolean;
  isDemoUser?: boolean;
};

type AdminRecipientOptions = {
  issueDepartmentIds?: string[];
};

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const USER_FACING_EVENTS: EmailEvent[] = ["status_changed", "resolved", "feedback_request"];
const DEMO_EMAILS = new Set(
  [
    process.env.DEMO_STUDENT_EMAIL || "demo.student@charusat.edu.in",
    process.env.DEMO_STAFF_EMAIL || "demo.worker@charusat.ac.in",
    process.env.DEMO_ADMIN_EMAIL || "demo.admin@CampusTrackerer.com",
    process.env.DEMO_DEPT_ADMIN_EMAIL || "demo.deptadmin@charusat.ac.in",
  ].map((email) => email.trim().toLowerCase())
);

function buildSubject(event: EmailEvent, title: string) {
  if (event === "created") return `CampusTracker: New issue reported - ${title}`;
  if (event === "assigned") return `CampusTracker: Issue assigned - ${title}`;
  if (event === "status_changed") return `CampusTracker: Issue status updated - ${title}`;
  if (event === "resolved") return `CampusTracker: Issue resolved - ${title}`;
  if (event === "overdue") return `CampusTracker: Overdue issue alert - ${title}`;
  return `CampusTracker: Feedback requested - ${title}`;
}

function normalizeId(value: unknown): string {
  let current: unknown = value;
  const seen = new Set<unknown>();

  while (current) {
    if (typeof current === "string") return current;
    if (typeof current === "number") return String(current);

    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) return "";
      seen.add(current);

      if ("_id" in current) {
        const nested = (current as { _id?: unknown })._id;
        if (nested && nested !== current) {
          current = nested;
          continue;
        }
      }

      if ("toString" in current) {
        const asString = (current as { toString: () => string }).toString();
        return asString === "[object Object]" ? "" : asString;
      }
    }

    return "";
  }

  return "";
}

function collectAdminDepartmentIds(admin: RecipientUser) {
  const ids = [
    normalizeId(admin.department),
    normalizeId(admin.academicDepartment),
    normalizeId(admin.serviceDepartment),
    ...(Array.isArray(admin.managedDepartments)
      ? admin.managedDepartments.map((value) => normalizeId(value))
      : []),
  ].filter(Boolean);

  return Array.from(new Set(ids));
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
  const isResolvedEvent = payload.event === "resolved";
  const eventLabel = payload.event.replaceAll("_", " ");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #065f46; color: #ffffff; padding: 16px 20px;">
        <h2 style="margin:0; font-size: 18px;">CampusTracker</h2>
        <p style="margin:4px 0 0; opacity: .9;">Smart Campus Issue Tracker</p>
      </div>
      <div style="padding: 20px;">
        <p style="margin-top: 0;"><strong>Event:</strong> ${eventLabel}</p>
        <p><strong>Issue:</strong> ${payload.issue.title}</p>
        <p><strong>Department:</strong> ${payload.issue.department || "-"}</p>
        <p><strong>Priority:</strong> ${payload.issue.priority || "-"}</p>
        <p><strong>Status:</strong> ${payload.issue.status || "-"}</p>
        ${payload.actorName ? `<p><strong>Updated by:</strong> ${payload.actorName}</p>` : ""}
        ${
          isResolvedEvent
            ? '<div style="margin-top: 14px; padding: 12px; border-radius: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #064e3b;">Your issue has been resolved. Please open the issue and submit your feedback so we can keep improving support quality.</div>'
            : ""
        }
        <p style="margin-top: 16px;"><a href="${issueUrl}" style="background:#0d9488;color:white;text-decoration:none;padding:10px 14px;border-radius:8px;display:inline-block;">${isResolvedEvent ? "View Issue & Give Feedback" : "View Issue"}</a></p>
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
    (user) => {
      const normalizedEmail = String(user.email || "").trim().toLowerCase();
      return (
        user.emailNotificationsEnabled !== false &&
        user.isDemoUser !== true &&
        Boolean(normalizedEmail) &&
        !DEMO_EMAILS.has(normalizedEmail)
      );
    }
  );

  if (recipients.length === 0) return;

  await Promise.all(
    recipients.map(async (recipient) => {
      const issuePath = USER_FACING_EVENTS.includes(payload.event)
        ? `/student/my-issues?issueId=${encodeURIComponent(payload.issue.id)}`
        : buildIssuePathForRecipient(payload.issue.id, recipient);
      const issueUrl = buildLoginUrlForRecipient(issuePath, recipient, payload.event);
      const text =
        payload.event === "resolved"
          ? `CampusTracker notification: ${payload.issue.title} is resolved. Please open the issue and share your feedback.`
          : `CampusTracker notification: ${payload.issue.title} (${payload.event})`;

      await transporter.sendMail({
        from: FROM,
        to: recipient.email,
        subject: buildSubject(payload.event, payload.issue.title),
        html: buildHtml(payload, issueUrl),
        text,
      });
    })
  );
}

export async function getAdminRecipientEmails(options?: AdminRecipientOptions) {
  const requestedDepartmentIds = Array.from(
    new Set((options?.issueDepartmentIds || []).map((value) => normalizeId(value)).filter(Boolean))
  );

  const shouldScopeDeptAdmins = requestedDepartmentIds.length > 0;

  const admins = await User.find({ role: "admin", isActive: { $ne: false } })
    .select(
      "email adminRole department academicDepartment serviceDepartment managedDepartments emailNotificationsEnabled isDemoUser"
    )
    .lean();

  const requestedSet = new Set(requestedDepartmentIds);

  return admins
    .filter((admin) => {
      const normalizedEmail = String(admin.email || "").trim().toLowerCase();
      const hasEmailAccess =
        admin.emailNotificationsEnabled !== false &&
        admin.isDemoUser !== true &&
        Boolean(normalizedEmail) &&
        !DEMO_EMAILS.has(normalizedEmail);

      if (!hasEmailAccess) return false;

      const effectiveAdminRole =
        admin.adminRole === "dept_admin" || admin.adminRole === "worker" || admin.adminRole === "super_admin"
          ? admin.adminRole
          : "super_admin";

      if (effectiveAdminRole === "super_admin") {
        return true;
      }

      if (effectiveAdminRole !== "dept_admin") {
        return false;
      }

      if (!shouldScopeDeptAdmins) {
        return true;
      }

      const adminDepartmentIds = collectAdminDepartmentIds(admin as RecipientUser);
      if (adminDepartmentIds.length === 0) return false;

      return adminDepartmentIds.some((id) => requestedSet.has(id));
    })
    .map((admin) => admin.email)
    .filter((email): email is string => Boolean(email));
}
