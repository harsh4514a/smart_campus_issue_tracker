"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DeptAdminShell from "@/components/dept-admin/DeptAdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  Clock3,
  ListChecks,
  ShieldAlert,
  UserRound,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Department = { _id: string; name: string; type?: string };

type DashboardResponse = {
  kpi: { total: number; pending: number; inProgress: number; resolved: number };
  alerts: { unassigned: number; overdue: number; highPriorityPending: number };
  todaySummary: { created: number; resolved: number };
  smartInsight: string;
  recentActivity: Array<{
    _id: string;
    issueId: string;
    issueTitle: string;
    action: string;
    timestamp?: string;
    performedBy?: { name?: string };
  }>;
  criticalIssues: Array<{
    _id: string;
    title: string;
    priority: string;
    dueDate?: string | null;
    status: string;
    overdue: boolean;
  }>;
  workerSummary: Array<{ _id: string; name: string; activeTasks: number; availability: "Available" | "Moderate" | "Overloaded" }>;
  trend: Array<{ _id: string; count: number }>;
  distribution: Array<{ _id: string; count: number }>;
  departments: Department[];
};

export default function DeptAdminDashboardPage() {
  const auth = useMemo(() => loadAuth(), []);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [departmentId, setDepartmentId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const quickSuggestions = useMemo(() => {
    if (!data) return [] as Array<{ id: string; label: string; href: string; className: string }>;

    const suggestions: Array<{ id: string; label: string; href: string; className: string }> = [];

    if (data.alerts.unassigned > 0) {
      suggestions.push({
        id: "unassigned",
        label: `Assign ${data.alerts.unassigned} unassigned issues`,
        href: "/dept-admin/issues?unassignedOnly=1",
        className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
      });
    }

    if (data.alerts.highPriorityPending > 0) {
      suggestions.push({
        id: "urgent",
        label: `${data.alerts.highPriorityPending} urgent issues pending`,
        href: "/dept-admin/issues?priority=Urgent&status=Pending",
        className: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
      });
    }

    if (data.alerts.overdue > 0) {
      suggestions.push({
        id: "overdue",
        label: `Resolve ${data.alerts.overdue} overdue issues`,
        href: "/dept-admin/issues?overdueOnly=1",
        className: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
      });
    }

    if (data.kpi.inProgress > 0) {
      suggestions.push({
        id: "inProgress",
        label: `Review ${data.kpi.inProgress} in-progress tasks`,
        href: "/dept-admin/issues?status=In%20Progress",
        className: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        id: "healthy",
        label: "System healthy. Review worker load balance",
        href: "/dept-admin/workers?sort=load_desc",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
      });
    }

    return suggestions.slice(0, 3);
  }, [data]);

  useEffect(() => {
    if (!auth) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (departmentId !== "all") params.set("departmentId", departmentId);
        const res = await authFetch(`/api/dept-admin/dashboard?${params.toString()}`, { method: "GET" }, auth.token);
        if (!cancelled) setData(res as DashboardResponse);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [auth, departmentId]);

  return (
    <DeptAdminShell title="Department Admin Dashboard" subtitle="Action-driven overview for department operations">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="text-sm font-medium text-slate-700 mr-2">Department Filter</label>
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="mt-2 h-10 w-full max-w-xs rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">All Departments</option>
            {(data?.departments || []).map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </select>
        </section>

        {loading ? <DashboardSkeleton /> : null}
        {!loading && error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

        {!loading && !error && data ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <KpiCard label="Total Issues" value={data.kpi.total} icon={<ListChecks className="h-4 w-4" />} href="/dept-admin/issues" />
              <KpiCard label="Pending" value={data.kpi.pending} icon={<Clock3 className="h-4 w-4" />} href="/dept-admin/issues?status=Pending" />
              <KpiCard label="In Progress" value={data.kpi.inProgress} icon={<AlertTriangle className="h-4 w-4" />} href="/dept-admin/issues?status=In%20Progress" />
              <KpiCard label="Resolved" value={data.kpi.resolved} icon={<CheckCircle2 className="h-4 w-4" />} href="/dept-admin/issues?status=Resolved" />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Today Summary</p>
                <p className="mt-2 text-sm text-cyan-900">Created: <strong>{data.todaySummary.created}</strong></p>
                <p className="text-sm text-cyan-900">Resolved: <strong>{data.todaySummary.resolved}</strong></p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">High Priority Pending</p>
                <p className="mt-2 text-2xl font-bold text-amber-900">{data.alerts.highPriorityPending}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Smart Insight</p>
                <p className="mt-2 text-sm text-slate-700">{data.smartInsight}</p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700">Intelligent Suggestions</h3>
                <div className="mt-3 grid gap-2">
                  {quickSuggestions.map((item) => (
                    <Link key={item.id} href={item.href} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${item.className}`}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-700">Recent Activity</h3>
                <div className="mt-3 space-y-2">
                  {data.recentActivity.length === 0 ? (
                    <p className="text-sm text-slate-500">No recent activity.</p>
                  ) : (
                    data.recentActivity.map((item) => (
                      <Link key={item._id} href={`/dept-admin/issues/${item.issueId}`} className="block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50">
                        <p className="flex items-center gap-2 font-medium">
                          <CircleDot className="h-4 w-4 text-emerald-600" />
                          {item.action} • {item.issueTitle}
                        </p>
                        <p className="ml-6 text-xs text-slate-500">
                          {item.performedBy?.name || "System"} • {item.timestamp ? new Date(item.timestamp).toLocaleString() : "-"}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ShieldAlert className="h-4 w-4 text-rose-600" /> Critical Issues
                </h3>
                <div className="mt-3 space-y-2">
                  {data.criticalIssues.length === 0 ? (
                    <p className="text-sm text-slate-500">No critical items right now.</p>
                  ) : (
                    data.criticalIssues.map((issue) => (
                      <Link key={issue._id} href={`/dept-admin/issues/${issue._id}`} className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 hover:bg-rose-100">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{issue.title}</p>
                          <p className="text-xs text-slate-600">{issue.priority} • {issue.status}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${issue.overdue ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800"}`}>
                          {issue.overdue ? "Overdue" : "High Priority"}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700">Smart Alerts</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <Link href="/dept-admin/issues?unassignedOnly=1" className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-700 hover:bg-amber-100">
                    <span>Unassigned issues</span>
                    <strong>{data.alerts.unassigned}</strong>
                  </Link>
                  <Link href="/dept-admin/issues?overdueOnly=1" className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-rose-700 hover:bg-rose-100">
                    <span>Overdue issues</span>
                    <strong>{data.alerts.overdue}</strong>
                  </Link>
                  <Link href="/dept-admin/issues?priority=High&status=Pending" className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-700 hover:bg-amber-100">
                    <span>High priority pending</span>
                    <strong>{data.alerts.highPriorityPending}</strong>
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700">Worker Summary</h3>
                <div className="mt-3 space-y-2">
                  {data.workerSummary.length === 0 ? (
                    <p className="text-sm text-slate-500">No workers mapped to your department.</p>
                  ) : (
                    data.workerSummary.map((worker) => (
                      <Link href={`/dept-admin/workers`} key={worker._id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-800"><UserRound className="h-4 w-4" />{worker.name}</p>
                        <div className="text-right text-xs">
                          <p className="text-slate-700">{worker.activeTasks} tasks</p>
                          <p className={
                            worker.availability === "Overloaded"
                              ? "text-rose-700"
                              : worker.availability === "Moderate"
                                ? "text-amber-700"
                                : "text-emerald-700"
                          }>{worker.availability}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700">Issue Distribution</h3>
                <div className="mt-4 space-y-2">
                  {data.distribution.map((row) => (
                    <div key={row._id || "Unknown"}>
                      <div className="mb-1 flex justify-between text-xs text-slate-600">
                        <span>{row._id || "Unknown"}</span>
                        <span>{row.count} ({Math.round((row.count / Math.max(1, data.kpi.total)) * 100)}%)</span>
                      </div>
                      <div className="h-2 rounded bg-slate-100">
                        <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.max(5, (row.count / Math.max(1, data.kpi.total)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Zap className="h-4 w-4 text-teal-600" /> Issue Trend (Last 7 days)</h3>
              <div className="mt-3 h-72">
                {data.trend.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                    No trend data available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend.map((row) => ({ date: row._id, issues: row.count }))} margin={{ top: 10, right: 16, left: 2, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const date = new Date(String(value));
                          if (Number.isNaN(date.getTime())) return String(value);
                          return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;
                        }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: "Issue Count", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#475569" } }} />
                      <Tooltip
                        formatter={(value) => [value, "Issues"]}
                        labelFormatter={(label) => {
                          const date = new Date(String(label));
                          return Number.isNaN(date.getTime()) ? String(label) : date.toDateString();
                        }}
                      />
                      <Legend iconType="circle" />
                      <Line
                        type="monotone"
                        dataKey="issues"
                        name="Issues Reported"
                        stroke="#0D9488"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><CalendarRange className="h-3.5 w-3.5" /> Daily reported issue count for the selected department scope.</p>
            </section>
          </>
        ) : null}
      </div>
    </DeptAdminShell>
  );
}

function KpiCard({ label, value, icon, href }: { label: string; value: number; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-md bg-emerald-100 p-2 text-emerald-700">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="skeleton-shimmer h-24 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton-shimmer h-48 rounded-xl border border-slate-200 bg-white" />
        <div className="skeleton-shimmer h-48 rounded-xl border border-slate-200 bg-white lg:col-span-2" />
      </div>
      <div className="skeleton-shimmer h-60 rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}
