import { StaffIssue } from "@/components/staff/useStaffIssues";

const PRIORITY_RANK: Record<NonNullable<StaffIssue["priority"]>, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4,
};

const SLA_HOURS_BY_PRIORITY: Record<NonNullable<StaffIssue["priority"]>, number> = {
  Low: 72,
  Medium: 48,
  High: 24,
  Urgent: 8,
};

const DEFAULT_SLA_HOURS = 48;

export type SlaLevel = "healthy" | "watch" | "risk";

export type SlaMeta = {
  level: SlaLevel;
  deadlineMs: number | null;
  deadlineLabel: string;
  progressPercent: number;
  remainingLabel: string;
  remainingMs: number | null;
  isOverdue: boolean;
};

export type FriendlySlaState = "on_time" | "due_soon" | "overdue";

export type SlaDisplay = {
  state: FriendlySlaState;
  label: string;
  timeMessage: string;
  technicalStatus: "Healthy" | "Risk" | "Breached";
  tone: "green" | "yellow" | "red";
  tooltip: string;
};

export type SlaHighlightLevel = "none" | "warning" | "critical";

export function getPriorityRank(priority?: StaffIssue["priority"] | null) {
  if (!priority) return 0;
  return PRIORITY_RANK[priority] || 0;
}

export function getSlaMeta(issue: StaffIssue): SlaMeta {
  const now = Date.now();
  const createdAtMs = toMs(issue.createdAt);
  const dueAtMs = toMs(issue.dueDate);
  const plannedSlaMs = getPlannedSlaMs(issue);
  const fallbackDeadline = createdAtMs ? createdAtMs + plannedSlaMs : null;
  const deadlineMs = dueAtMs || fallbackDeadline;

  if (!deadlineMs) {
    return {
      level: "healthy",
      deadlineMs: null,
      deadlineLabel: "No SLA deadline",
      progressPercent: 0,
      remainingLabel: "No deadline",
      remainingMs: null,
      isOverdue: false,
    };
  }

  const startMs = createdAtMs || deadlineMs - plannedSlaMs;
  const totalWindowMs = Math.max(deadlineMs - startMs, 1);
  const elapsedMs = Math.max(now - startMs, 0);
  const rawProgress = Math.min(100, Math.round((elapsedMs / totalWindowMs) * 100));
  const remainingMs = deadlineMs - now;
  const isOverdue = remainingMs < 0;

  const level: SlaLevel = isOverdue ? "risk" : rawProgress >= 80 ? "watch" : "healthy";

  if (issue.status === "Resolved" || issue.status === "Rejected") {
    return {
      level: isOverdue ? "risk" : "healthy",
      deadlineMs,
      deadlineLabel: `Deadline ${formatDateTime(deadlineMs)}`,
      progressPercent: 100,
      remainingLabel: isOverdue ? "Closed after deadline" : "Closed within SLA",
      remainingMs,
      isOverdue,
    };
  }

  return {
    level,
    deadlineMs,
    deadlineLabel: `Deadline ${formatDateTime(deadlineMs)}`,
    progressPercent: rawProgress,
    remainingLabel: isOverdue ? `${formatDuration(Math.abs(remainingMs))} overdue` : `${formatDuration(remainingMs)} left`,
    remainingMs,
    isOverdue,
  };
}

export function getSlaDisplay(meta: SlaMeta): SlaDisplay {
  const state: FriendlySlaState = meta.isOverdue ? "overdue" : meta.level === "watch" ? "due_soon" : "on_time";
  const technicalStatus = state === "overdue" ? "Breached" : state === "due_soon" ? "Risk" : "Healthy";
  const deadlineText = meta.deadlineMs ? formatDateTime(meta.deadlineMs) : "Not set";
  const absoluteDuration = formatNaturalTime(Math.abs(meta.remainingMs || 0));

  const label = state === "overdue" ? "🔴 Overdue" : state === "due_soon" ? "🟡 Due Soon" : "🟢 On Time";
  const tone = state === "overdue" ? "red" : state === "due_soon" ? "yellow" : "green";

  let timeMessage = "⏳ Deadline not set";
  if (meta.deadlineMs) {
    if (state === "overdue") {
      timeMessage = `🚨 Overdue by ${absoluteDuration}`;
    } else if (state === "due_soon") {
      timeMessage = `⚠️ Due in ${absoluteDuration}`;
    } else {
      timeMessage = `⏳ ${absoluteDuration} left`;
    }
  }

  return {
    state,
    label,
    timeMessage,
    technicalStatus,
    tone,
    tooltip: `Deadline: ${deadlineText} | SLA Status: ${technicalStatus}`,
  };
}

export function getSlaHighlight(issue: StaffIssue, meta: SlaMeta = getSlaMeta(issue)): SlaHighlightLevel {
  const display = getSlaDisplay(meta);

  if (issue.priority === "Urgent" && display.state === "overdue") return "critical";
  if ((issue.priority === "High" || issue.priority === "Urgent") && display.state === "due_soon") return "warning";
  if (display.state === "overdue") return "warning";
  return "none";
}

export function getNextBestAction(issue: StaffIssue) {
  const sla = getSlaMeta(issue);

  if (issue.status === "Resolved" || issue.status === "Rejected") {
    return "Issue is closed. Review final notes and requester communication.";
  }

  if (issue.status === "Pending") {
    if (issue.priority === "Urgent" || issue.priority === "High") {
      return "Move to In Progress immediately and notify requester with ETA.";
    }
    return "Start investigation, update status to In Progress, and share first update.";
  }

  if (sla.level === "risk") {
    return "Escalate blockers now. Deadline is overdue or very close.";
  }

  if (sla.level === "watch") {
    return "Post progress update and target same-shift resolution.";
  }

  return "Continue execution and resolve once validation is complete.";
}

export function getIssueTimestamp(issue: StaffIssue) {
  const created = toMs(issue.createdAt);
  const due = toMs(issue.dueDate);
  return {
    created,
    due,
  };
}

export function formatRelativeTime(value?: string) {
  const time = toMs(value);
  if (!time) return "just now";

  const diffMs = Date.now() - time;
  if (diffMs < 60 * 1000) return "just now";

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

export function formatDateTime(value: number | string) {
  const time = typeof value === "number" ? value : toMs(value);
  if (!time) return "-";
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value?: string) {
  const time = toMs(value);
  if (!time) return "-";
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPlannedSlaMs(issue: StaffIssue) {
  const priority = issue.priority || "Medium";
  const hours = SLA_HOURS_BY_PRIORITY[priority] || DEFAULT_SLA_HOURS;
  return hours * 60 * 60 * 1000;
}

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / (60 * 1000));
  if (totalMinutes < 60) return `${Math.max(totalMinutes, 1)} min`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours} hr${totalHours > 1 ? "s" : ""}`;

  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays} day${totalDays > 1 ? "s" : ""}`;
}

function formatNaturalTime(ms: number) {
  const totalMinutes = Math.max(Math.ceil(ms / (60 * 1000)), 1);
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes > 1 ? "s" : ""}`;

  const totalHours = Math.ceil(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours} hour${totalHours > 1 ? "s" : ""}`;

  const totalDays = Math.ceil(totalHours / 24);
  return `${totalDays} day${totalDays > 1 ? "s" : ""}`;
}

function toMs(value?: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return time;
}
