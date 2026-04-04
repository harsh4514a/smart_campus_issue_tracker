"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, TrendingDown, TrendingUp } from "lucide-react";
import DeptAdminShell from "@/components/dept-admin/DeptAdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import { useToast } from "@/components/ToastProvider";

const DeptAdminReportsCharts = dynamic(
  () => import("@/components/dept-admin/DeptAdminReportsCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="skeleton-shimmer h-80 rounded-xl border border-slate-200 bg-white" />
        <div className="skeleton-shimmer h-80 rounded-xl border border-slate-200 bg-white" />
      </div>
    ),
  }
);

type Department = { _id: string; name: string; type?: string };

type ReportsData = {
  metrics: {
    total: number;
    resolutionRate: number | null;
    slaCompliance: number;
    unassigned: number;
  };
  alerts: {
    unassigned: number;
    highPriorityPending: number;
    overdue: number;
  };
  insights: {
    topIssueCategory: string;
    mostActiveDepartment: string;
  };
  monthlyComparison: {
    raised: { current: number; previous: number; delta: number };
    resolved: { current: number; previous: number; delta: number };
  };
  trend: Array<{ date: string; created: number; resolved: number }>;
  priorityDistribution: Array<{ priority: string; count: number; percentage: number }>;
  statusDistribution: Array<{ _id: string; count: number }>;
  workerPerformance: Array<{
    workerId: string;
    name: string;
    total: number;
    resolved: number;
    pending: number;
    resolutionRate: number | null;
  }>;
  departments: Department[];
  categories: string[];
};

export default function DeptAdminReportsPage() {
  const router = useRouter();
  const auth = useMemo(() => loadAuth(), []);
  const { showToast } = useToast();

  const [from, setFrom] = useState(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState("all");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ReportsData | null>(null);

  const hasInvalidDateRange = Boolean(from && to && new Date(from).getTime() > new Date(to).getTime());
  const selectedDateLabel = useMemo(() => {
    if (!from || !to) return "All time";
    return `${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}`;
  }, [from, to]);

  const load = async (signal?: AbortSignal) => {
    if (!auth) return;

    if (hasInvalidDateRange) {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
      showToast({
        title: "Invalid Date Range",
        message: "From date cannot be after To date.",
        variant: "error",
      });
      return;
    }

    if (!data) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (departmentId !== "all") params.set("departmentId", departmentId);
      if (category !== "all") params.set("category", category);
      const res = await authFetch(
        `/api/dept-admin/reports?${params.toString()}`,
        { method: "GET", signal },
        auth.token
      );

      if (signal?.aborted) return;
      setData(res as ReportsData);
    } catch (err) {
      if (signal?.aborted) return;
      showToast({ title: "Load Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const exportCsv = async () => {
    if (!auth) return;

    if (hasInvalidDateRange) {
      showToast({
        title: "Invalid Date Range",
        message: "From date cannot be after To date.",
        variant: "error",
      });
      return;
    }

    try {
      const params = new URLSearchParams({ format: "csv" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (departmentId !== "all") params.set("departmentId", departmentId);
      if (category !== "all") params.set("category", category);

      const response = await fetch(`/api/dept-admin/reports?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to export CSV");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dept-admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast({ title: "Export Ready", message: "CSV report downloaded.", variant: "success" });
    } catch (err) {
      showToast({ title: "Export Failed", message: err instanceof Error ? err.message : "Failed", variant: "error" });
    }
  };

  const exportPdf = () => {
    if (hasInvalidDateRange) {
      showToast({
        title: "Invalid Date Range",
        message: "From date cannot be after To date.",
        variant: "error",
      });
      return;
    }

    window.print();
    showToast({ title: "Print Dialog Opened", message: "Use your browser to save as PDF.", variant: "info" });
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, departmentId, category, hasInvalidDateRange]);

  const hasNoData = !!data && data.metrics.total === 0;
  const topPerformerId = useMemo(() => {
    if (!data?.workerPerformance?.length) return null;
    const eligible = data.workerPerformance.filter((worker) => worker.total > 0 && worker.resolutionRate !== null);
    if (eligible.length === 0) return null;
    return eligible.sort((a, b) => {
      const rateDiff = Number(b.resolutionRate || 0) - Number(a.resolutionRate || 0);
      if (rateDiff !== 0) return rateDiff;
      return b.resolved - a.resolved;
    })[0].workerId;
  }, [data?.workerPerformance]);

  const issueCtaHref = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("dateFrom", from);
    if (to) params.set("dateTo", to);
    if (category !== "all") params.set("category", category);

    if (data?.alerts.unassigned) {
      params.set("unassignedOnly", "1");
    } else if (data?.alerts.highPriorityPending) {
      params.set("status", "Pending");
      params.set("priority", "High");
    } else if (data?.alerts.overdue) {
      params.set("overdueOnly", "1");
    }

    const query = params.toString();
    return query ? `/dept-admin/issues?${query}` : "/dept-admin/issues";
  }, [category, data?.alerts.highPriorityPending, data?.alerts.overdue, data?.alerts.unassigned, from, to]);

  return (
    <DeptAdminShell
      title="Reports & Analytics"
      subtitle="Actionable department insights for faster decisions"
      actions={(
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileDown className="h-4 w-4" /> CSV
          </button>
          <button onClick={exportPdf} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileDown className="h-4 w-4" /> PDF
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">All Departments</option>
            {(data?.departments || []).map((department) => (
              <option key={department._id} value={department._id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            {(data?.categories || []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </section>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Showing data for: {selectedDateLabel}</p>
          {refreshing ? <p className="text-xs font-medium text-slate-500">Refreshing...</p> : null}
        </div>

        {!loading && data ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-amber-900">
                ⚠ {data.alerts.unassigned} Unassigned | 🔥 {data.alerts.highPriorityPending} High Priority Pending | ⏰ {data.alerts.overdue} Overdue
              </p>
              <button
                type="button"
                onClick={() => router.push(issueCtaHref)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                View Issues
              </button>
            </div>
          </section>
        ) : null}

        {loading && !data ? (
          <ReportsSkeleton />
        ) : !data ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No report data found.</div>
        ) : hasNoData ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No data available yet for selected filters.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <MetricCard label="Total Issues" value={String(data.metrics.total)} />
              <MetricCard label="Resolution Rate" value={data.metrics.resolutionRate === null ? "N/A" : `${data.metrics.resolutionRate}%`} />
              <MetricCard label="SLA Compliance" value={`${data.metrics.slaCompliance}%`} />
              <MetricCard label="Unassigned Issues" value={String(data.metrics.unassigned)} />
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InsightCard label="Top Issue Category" value={data.insights.topIssueCategory} />
              <InsightCard label="Most Active Department" value={data.insights.mostActiveDepartment} />
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ComparisonCard title="Raised (Month vs Last Month)" current={data.monthlyComparison.raised.current} previous={data.monthlyComparison.raised.previous} delta={data.monthlyComparison.raised.delta} />
              <ComparisonCard title="Resolved (Month vs Last Month)" current={data.monthlyComparison.resolved.current} previous={data.monthlyComparison.resolved.previous} delta={data.monthlyComparison.resolved.delta} />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DeptAdminReportsCharts
                trend={data.trend}
                priorityDistribution={data.priorityDistribution}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700">Worker Performance</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2">Worker</th>
                      <th className="pb-2">Total Assigned</th>
                      <th className="pb-2">Pending Issues</th>
                      <th className="pb-2">Resolved</th>
                      <th className="pb-2">Resolution Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workerPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-sm text-slate-500">
                          No worker performance data for selected filters.
                        </td>
                      </tr>
                    ) : data.workerPerformance.map((worker) => (
                      <tr
                        key={worker.workerId}
                        className={`border-t border-slate-100 ${worker.workerId === topPerformerId ? "bg-emerald-50/40" : ""}`}
                      >
                        <td className="py-2">{worker.name}</td>
                        <td className="py-2">{worker.total}</td>
                        <td className="py-2">{worker.pending}</td>
                        <td className="py-2">{worker.resolved}</td>
                        <td className="py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${resolutionRateTone(worker.resolutionRate)}`}>
                            {worker.resolutionRate === null ? "N/A" : `${worker.resolutionRate}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </DeptAdminShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ComparisonCard({ title, current, previous, delta }: { title: string; current: number; previous: number; delta: number }) {
  const up = delta >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mt-3 text-2xl font-bold text-slate-900">{current}</p>
      <p className="text-sm text-slate-500">Last month: {previous}</p>
      <p className={`mt-2 inline-flex items-center gap-1 text-sm font-semibold ${up ? "text-emerald-700" : "text-rose-700"}`}>
        {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {up ? "+" : ""}{delta}
      </p>
    </div>
  );
}

function resolutionRateTone(rate: number | null) {
  if (rate === null) return "bg-slate-100 text-slate-700";
  if (rate > 70) return "bg-emerald-100 text-emerald-700";
  if (rate >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="skeleton-shimmer h-24 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="skeleton-shimmer h-44 rounded-xl border border-slate-200 bg-white" />
        <div className="skeleton-shimmer h-44 rounded-xl border border-slate-200 bg-white" />
      </div>
      <div className="skeleton-shimmer h-64 rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}
