"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Bell, Sparkles } from "lucide-react";
import { formatRelativeTime, getPriorityRank, getSlaDisplay, getSlaMeta } from "@/components/staff/issue-utils";
import { StaffEmptyState, StaffListSkeleton, StaffPriorityBadge, StaffStatusBadge, TimeIndicator } from "@/components/staff/staff-ui";
import { StaffIssue, useStaffIssues } from "@/components/staff/useStaffIssues";

type NotificationItem = {
  id: string;
  issueId: string;
  issue: StaffIssue;
  title: string;
  description: string;
  timestampLabel: string;
  severity: "high" | "normal" | "positive";
  status: StaffIssue["status"];
  priority?: StaffIssue["priority"] | null;
  slaMeta?: ReturnType<typeof getSlaMeta>;
};

export default function StaffNotificationsPage() {
  const { issues, loading, error } = useStaffIssues();

  const highPriorityNotifications = useMemo(() => buildHighPriorityNotifications(issues), [issues]);
  const recentNotifications = useMemo(() => buildRecentActivityNotifications(issues), [issues]);

  return (
    <div className="space-y-4">
      {loading && issues.length === 0 ? <StaffListSkeleton rows={5} /> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900">Smart Notifications</h2>
              </div>
              <Link href="/staff/issues" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                Open Assigned Issues
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {highPriorityNotifications.length === 0 && recentNotifications.length === 0 ? (
              <StaffEmptyState
                title="No notifications right now"
                description="You are all caught up. New issue events will appear here automatically."
                actionHref="/staff/issues"
                actionLabel="View issues"
              />
            ) : (
              <div className="space-y-5">
                <NotificationGroup
                  title="High Priority"
                  icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
                  items={highPriorityNotifications}
                  emptyText="No high-priority alerts."
                />
                <NotificationGroup
                  title="Recent Activity"
                  icon={<Sparkles className="h-4 w-4 text-emerald-600" />}
                  items={recentNotifications}
                  emptyText="No recent activity yet."
                />
              </div>
            )}
          </section>
    </div>
  );
}

function NotificationGroup({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: NotificationItem[];
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/staff/issues/${item.issueId}`}
              prefetch={false}
              className={`block rounded-lg border px-3 py-3 transition hover:shadow-sm ${
                item.severity === "high"
                  ? "border-rose-200 bg-rose-50/50"
                  : item.severity === "positive"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.timestampLabel}</p>
              </div>

              <p className="mt-1 text-sm text-slate-600">{item.description}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StaffStatusBadge status={item.status} />
                <StaffPriorityBadge priority={item.priority} />
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                  View Issue
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>

              {item.slaMeta ? (
                <div className="mt-2 max-w-md">
                  <TimeIndicator issue={item.issue} meta={item.slaMeta} showProgress={false} compact />
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function buildHighPriorityNotifications(issues: StaffIssue[]): NotificationItem[] {
  return issues
    .filter((issue) => {
      if (issue.status === "Resolved" || issue.status === "Rejected") return false;
      const highPriority = issue.priority === "High" || issue.priority === "Urgent";
      const slaMeta = getSlaMeta(issue);
      return highPriority || slaMeta.level === "risk";
    })
    .sort((a, b) => {
      const aSla = getSlaMeta(a);
      const bSla = getSlaMeta(b);
      const aRisk = aSla.level === "risk" ? 2 : aSla.level === "watch" ? 1 : 0;
      const bRisk = bSla.level === "risk" ? 2 : bSla.level === "watch" ? 1 : 0;

      const riskDiff = bRisk - aRisk;
      if (riskDiff !== 0) return riskDiff;

      const priorityDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      return getSortTimestamp(b) - getSortTimestamp(a);
    })
    .slice(0, 8)
    .map((issue) => {
      const slaMeta = getSlaMeta(issue);
      const display = getSlaDisplay(slaMeta);
      const riskDescription = display.state === "overdue"
        ? `${display.timeMessage}. Immediate action required.`
        : `${display.timeMessage}. Prioritize this issue in your queue.`;

      return {
        id: `high-${issue._id}`,
        issueId: issue._id,
        issue,
        title: issue.title,
        description: riskDescription,
        timestampLabel: formatRelativeTime(issue.updatedAt || issue.createdAt),
        severity: "high" as const,
        status: issue.status,
        priority: issue.priority,
        slaMeta,
      };
    });
}

function buildRecentActivityNotifications(issues: StaffIssue[]): NotificationItem[] {
  return [...issues]
    .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a))
    .slice(0, 10)
    .map((issue) => {
      const description =
        issue.status === "Resolved"
          ? "Issue was resolved. Verify closure details and requester communication."
          : issue.status === "In Progress"
            ? "Work is currently in progress. Keep updates visible to requester."
            : "Issue is pending and waiting for action.";

      return {
        id: `recent-${issue._id}`,
        issueId: issue._id,
        issue,
        title: issue.title,
        description,
        timestampLabel: formatRelativeTime(issue.updatedAt || issue.createdAt),
        severity: issue.status === "Resolved" ? ("positive" as const) : ("normal" as const),
        status: issue.status,
        priority: issue.priority,
      };
    });
}

function getSortTimestamp(issue: StaffIssue) {
  const updatedAt = issue.updatedAt ? new Date(issue.updatedAt).getTime() : 0;
  const createdAt = issue.createdAt ? new Date(issue.createdAt).getTime() : 0;
  return Math.max(updatedAt || 0, createdAt || 0);
}
