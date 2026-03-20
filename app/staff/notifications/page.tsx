"use client";

import Link from "next/link";
import { useMemo } from "react";
import { StaffIssue, useStaffIssues } from "@/components/staff/useStaffIssues";

const OVERDUE_DAYS = 7;

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  severity: "high" | "normal" | "positive";
};

export default function StaffNotificationsPage() {
  const { issues, loading, error } = useStaffIssues();

  const notifications = useMemo(() => buildNotifications(issues), [issues]);

  return (
    <div className="space-y-4">
      {loading && issues.length === 0 ? <div className="text-sm text-slate-600">Loading notifications...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Activity Feed</h2>
              <Link href="/staff/issues" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                Open Assigned Issues
              </Link>
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No recent updates. You are all caught up.
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-lg border px-3 py-3 ${
                      item.severity === "high"
                        ? "border-rose-200 bg-rose-50/60"
                        : item.severity === "positive"
                          ? "border-green-200 bg-green-50/60"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
    </div>
  );
}

function buildNotifications(issues: StaffIssue[]): NotificationItem[] {
  const pending = issues.filter((issue) => issue.status === "Pending").length;
  const inProgress = issues.filter((issue) => issue.status === "In Progress").length;
  const resolved = issues.filter((issue) => issue.status === "Resolved").length;
  const highPriority = issues.filter((issue) => issue.priority === "High" || issue.priority === "Urgent").length;
  const overdue = issues.filter((issue) => isOverdue(issue)).length;

  const items: NotificationItem[] = [];

  if (overdue > 0) {
    items.push({
      id: "overdue",
      title: `${overdue} overdue issue${overdue > 1 ? "s" : ""} require attention`,
      description: `These issues are open for more than ${OVERDUE_DAYS} days. Prioritize them to avoid SLA delays.`,
      severity: "high",
    });
  }

  if (highPriority > 0) {
    items.push({
      id: "priority",
      title: `${highPriority} high-priority issue${highPriority > 1 ? "s" : ""} in queue`,
      description: "High and urgent incidents are active in your assignment list.",
      severity: "high",
    });
  }

  if (pending > 0) {
    items.push({
      id: "pending",
      title: `${pending} pending issue${pending > 1 ? "s" : ""} waiting for progress`,
      description: "Move pending tasks into in-progress to keep response time healthy.",
      severity: "normal",
    });
  }

  if (inProgress > 0) {
    items.push({
      id: "inprogress",
      title: `${inProgress} issue${inProgress > 1 ? "s" : ""} currently in progress`,
      description: "Keep these tickets updated and close resolved work quickly.",
      severity: "normal",
    });
  }

  if (resolved > 0) {
    items.push({
      id: "resolved",
      title: `${resolved} issue${resolved > 1 ? "s" : ""} resolved`,
      description: "Great progress. Continue maintaining response quality.",
      severity: "positive",
    });
  }

  if (items.length === 0) {
    return [
      {
        id: "empty",
        title: "No active issues at the moment",
        description: "You will receive alerts here when new or critical issues appear.",
        severity: "normal",
      },
    ];
  }

  return items;
}

function isOverdue(issue: StaffIssue) {
  if (issue.status === "Resolved") return false;
  if (!issue.createdAt) return false;

  const created = new Date(issue.createdAt).getTime();
  if (Number.isNaN(created)) return false;

  return Date.now() - created > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}
