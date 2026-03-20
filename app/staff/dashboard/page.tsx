"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, LoaderCircle, MapPin } from "lucide-react";
import { StaffIssue, useStaffIssues } from "@/components/staff/useStaffIssues";

const OVERDUE_DAYS = 7;

export default function StaffDashboard() {
  const { issues, loading, error } = useStaffIssues();

  const metrics = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((issue) => issue.status === "Pending").length;
    const inProgress = issues.filter((issue) => issue.status === "In Progress").length;
    const resolved = issues.filter((issue) => issue.status === "Resolved").length;

    const overdue = issues.filter((issue) => isOverdue(issue)).length;
    const urgent = issues.filter((issue) => issue.priority === "Urgent" || issue.priority === "High").length;

    return { total, pending, inProgress, resolved, overdue, urgent };
  }, [issues]);

  const recentIssues = useMemo(() => issues.slice(0, 5), [issues]);

  return (
    <div className="space-y-5">
      {loading && issues.length === 0 ? <div className="text-sm text-slate-600">Loading dashboard...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard label="Total Issues" value={metrics.total} tone="slate" Icon={Clock3} />
            <MetricCard label="Pending" value={metrics.pending} tone="amber" Icon={Clock3} />
            <MetricCard label="In Progress" value={metrics.inProgress} tone="blue" Icon={LoaderCircle} />
            <MetricCard label="Resolved" value={metrics.resolved} tone="green" Icon={CheckCircle2} />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm xl:col-span-1">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h2 className="text-base font-semibold text-rose-800">Needs Attention</h2>
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
                <h2 className="text-lg font-semibold text-slate-900">Recent Issues</h2>
                <Link
                  href="/staff/issues"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {recentIssues.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No issues assigned yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentIssues.map((issue) => (
                    <article
                      key={issue._id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link href={`/staff/issues/${issue._id}`} className="truncate text-sm font-semibold text-slate-900 hover:underline">
                          {issue.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {issue.location || "—"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {issue.category}
                          </span>
                          {issue.priority ? (
                            <span className="text-rose-600">{issue.priority}</span>
                          ) : null}
                        </div>
                      </div>
                      <IssueStatusBadge status={issue.status} />
                    </article>
                  ))}
                </div>
              )}
            </div>
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

function IssueStatusBadge({ status }: { status: StaffIssue["status"] }) {
  const style =
    status === "Resolved"
      ? "bg-green-100 text-green-700"
      : status === "In Progress"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{status}</span>;
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
