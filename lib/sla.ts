export type SlaPriority = "Low" | "Medium" | "High" | "Urgent" | null | undefined;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function calculateDueDateByPriority(priority: SlaPriority, fromDate?: Date) {
  const base = fromDate ? new Date(fromDate) : new Date();

  if (priority === "High" || priority === "Urgent") {
    return new Date(base.getTime() + 24 * HOUR_MS);
  }

  if (priority === "Low") {
    return new Date(base.getTime() + 7 * DAY_MS);
  }

  // Default SLA for medium or unspecified priority.
  return new Date(base.getTime() + 72 * HOUR_MS);
}

export function getOverdueMs(dueDate?: string | Date | null, now = Date.now()) {
  if (!dueDate) return 0;

  const due = dueDate instanceof Date ? dueDate.getTime() : new Date(dueDate).getTime();
  if (Number.isNaN(due)) return 0;

  return Math.max(now - due, 0);
}

export function isIssueOverdue(dueDate?: string | Date | null, status?: string) {
  if (status === "Resolved" || status === "Rejected") return false;
  return getOverdueMs(dueDate) > 0;
}

export function formatOverdueDuration(overdueMs: number) {
  if (overdueMs <= 0) return "0h";

  const days = Math.floor(overdueMs / DAY_MS);
  if (days >= 1) {
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  const hours = Math.max(1, Math.floor(overdueMs / HOUR_MS));
  return `${hours} hour${hours > 1 ? "s" : ""}`;
}
