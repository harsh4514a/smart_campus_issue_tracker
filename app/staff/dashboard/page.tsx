"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, LoaderCircle, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { formatDate, getNextBestAction, getPriorityRank, getSlaHighlight, getSlaMeta } from "@/components/staff/issue-utils";
import {
  StaffEmptyState,
  StaffListSkeleton,
  StaffPriorityBadge,
  StaffStatusBadge,
  TimeIndicator,
} from "@/components/staff/staff-ui";
import { StaffIssue, useStaffIssues } from "@/components/staff/useStaffIssues";

const OVERDUE_DAYS = 7;
const NEXT_STATUS: Record<StaffIssue["status"], StaffIssue["status"]> = {
  Pending: "In Progress",
  "In Progress": "Resolved",
  Resolved: "Resolved",
  Rejected: "Rejected",
};

export default function StaffDashboard() {
  const { issues, loading, error, setError, reload } = useStaffIssues();
  const { showToast } = useToast();
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((issue) => issue.status === "Pending").length;
    const inProgress = issues.filter((issue) => issue.status === "In Progress").length;
    const resolved = issues.filter((issue) => issue.status === "Resolved").length;

    const overdue = issues.filter((issue) => isOverdue(issue)).length;
    const urgent = issues.filter((issue) => issue.priority === "Urgent" || issue.priority === "High").length;

    return { total, pending, inProgress, resolved, overdue, urgent };
  }, [issues]);

  const actionRequiredIssues = useMemo(() => {
    return issues
      .filter((issue) => {
        if (issue.status === "Resolved") return false;
        const highPriority = issue.priority === "Urgent" || issue.priority === "High";
        const slaMeta = getSlaMeta(issue);
        return highPriority || slaMeta.level === "risk" || slaMeta.isOverdue;
      })
      .sort((a, b) => {
        const aSla = getSlaMeta(a);
        const bSla = getSlaMeta(b);

        const riskRank = (meta: ReturnType<typeof getSlaMeta>) => (meta.level === "risk" ? 2 : meta.level === "watch" ? 1 : 0);
        const riskDiff = riskRank(bSla) - riskRank(aSla);
        if (riskDiff !== 0) return riskDiff;

        const priorityDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority);
        if (priorityDiff !== 0) return priorityDiff;

        const aDue = aSla.deadlineMs || Number.MAX_SAFE_INTEGER;
        const bDue = bSla.deadlineMs || Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })
      .slice(0, 6);
  }, [issues]);

  const recommendedActions = useMemo(() => {
    return actionRequiredIssues.slice(0, 4).map((issue) => ({
      issue,
      recommendation: getNextBestAction(issue),
    }));
  }, [actionRequiredIssues]);

  const recentIssues = useMemo(() => issues.slice(0, 5), [issues]);

  const handleQuickStatusAction = async (issue: StaffIssue, status: StaffIssue["status"]) => {
    const auth = loadAuth();
    if (!auth) return;

    setUpdatingIssueId(issue._id);
    try {
      await authFetch(
        `/api/issues/${issue._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
        auth.token
      );

      await reload(true);
      showToast({
        title: "Updated",
        message: `Issue moved to ${status}.`,
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update issue status";
      setError(message);
      showToast({
        title: "Update failed",
        message,
        variant: "error",
      });
    } finally {
      setUpdatingIssueId(null);
    }
  };

  return (
    <div className="space-y-5">
      {loading && issues.length === 0 ? <StaffListSkeleton rows={6} /> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="Total Issues" value={metrics.total} tone="slate" Icon={Clock3} />
            <MetricCard label="Pending" value={metrics.pending} tone="amber" Icon={Clock3} />
            <MetricCard label="In Progress" value={metrics.inProgress} tone="blue" Icon={LoaderCircle} />
            <MetricCard label="Resolved" value={metrics.resolved} tone="green" Icon={CheckCircle2} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <h2 className="text-lg font-semibold text-slate-900">Action Required</h2>
              </div>
              <Link href="/staff/issues" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                Open Assigned Issues
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {actionRequiredIssues.length === 0 ? (
              <StaffEmptyState
                title="No urgent actions"
                description="All high-priority and deadline-risk issues are under control."
                actionHref="/staff/issues"
                actionLabel="Review all issues"
              />
            ) : (
              <div className="space-y-3">
                {actionRequiredIssues.map((issue) => {
                  const slaMeta = getSlaMeta(issue);
                  const highlight = getSlaHighlight(issue, slaMeta);
                  const nextAction = getNextBestAction(issue);
                  const canAdvance = issue.status !== "Resolved";
                  const advanceTarget = NEXT_STATUS[issue.status];

                  return (
                    <article
                      key={issue._id}
                      className={`rounded-xl border p-4 transition ${
                        highlight === "critical"
                          ? "border-rose-300 bg-rose-50/80"
                          : highlight === "warning"
                            ? "border-amber-300 bg-amber-50/80"
                          : slaMeta.level === "risk"
                          ? "border-rose-200 bg-rose-50/70"
                          : slaMeta.level === "watch"
                            ? "border-amber-200 bg-amber-50/70"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/staff/issues/${issue._id}`} prefetch={false} className="truncate text-base font-semibold text-slate-900 hover:underline">
                              {issue.title}
                            </Link>
                            <StaffStatusBadge status={issue.status} />
                            <StaffPriorityBadge priority={issue.priority} />
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {issue.location || "-"}
                            </span>
                            <span>{formatDate(issue.createdAt)}</span>
                          </div>

                          <div className="mt-2 max-w-md">
                            <TimeIndicator issue={issue} meta={slaMeta} showProgress={false} compact />
                          </div>

                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-800">Recommended Next Action:</span> {nextAction}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/staff/issues/${issue._id}`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View Issue
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleQuickStatusAction(issue, "Resolved")}
                            disabled={updatingIssueId === issue._id || issue.status === "Resolved"}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingIssueId === issue._id ? "Updating..." : "Resolve"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickStatusAction(issue, advanceTarget)}
                            disabled={updatingIssueId === issue._id || !canAdvance}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {issue.status === "Pending" ? "Update Status" : "Advance to Resolved"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm xl:col-span-1">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h2 className="text-base font-semibold text-rose-800">Deadline Watch</h2>
              </div>
              <div className="space-y-2">
                <Link
                  href="/staff/issues"
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>Overdue ({OVERDUE_DAYS}+ days)</span>
                  <span className="font-semibold text-slate-900">{metrics.overdue}</span>
                </Link>
                <Link
                  href="/staff/issues"
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>High / Urgent Priority</span>
                  <span className="font-semibold text-slate-900">{metrics.urgent}</span>
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Recommended Next Actions</h2>
                </div>
                <Link
                  href="/staff/issues"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {recommendedActions.length === 0 ? (
                <StaffEmptyState
                  title="No recommendations right now"
                  description="As new issues come in, assistant recommendations will appear here."
                  actionHref="/staff/issues"
                  actionLabel="Open issues"
                />
              ) : (
                <div className="space-y-2">
                  {recommendedActions.map(({ issue, recommendation }) => (
                    <article
                      key={issue._id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link href={`/staff/issues/${issue._id}`} prefetch={false} className="truncate text-sm font-semibold text-slate-900 hover:underline">
                          {issue.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-600">{recommendation}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StaffStatusBadge status={issue.status} />
                        <Link
                          href={`/staff/issues/${issue._id}`}
                          prefetch={false}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Recent Issues</h2>
              <Link href="/staff/issues" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {recentIssues.length === 0 ? (
              <StaffEmptyState
                title="No issues assigned yet"
                description="New assigned issues will appear here automatically."
                actionHref="/staff/issues"
                actionLabel="Go to issues"
              />
            ) : (
              <div className="space-y-2">
                {recentIssues.map((issue) => (
                  <article
                    key={issue._id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link href={`/staff/issues/${issue._id}`} prefetch={false} className="truncate text-sm font-semibold text-slate-900 hover:underline">
                        {issue.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {issue.location || "-"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {issue.category}
                        </span>
                        <span>{formatDate(issue.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StaffPriorityBadge priority={issue.priority} />
                      <StaffStatusBadge status={issue.status} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <QuickAction href="/staff/issues?status=Pending" label="Process Pending" />
              <QuickAction href="/staff/issues?status=In%20Progress" label="Update In Progress" />
              <QuickAction href="/staff/notifications" label="Review Notifications" />
            </div>
          </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "blue" | "green";
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClass: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}

function isOverdue(issue: StaffIssue) {
  if (issue.status === "Resolved") return false;
  if (!issue.createdAt) return false;

  const created = new Date(issue.createdAt).getTime();
  if (Number.isNaN(created)) return false;

  return Date.now() - created > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}
