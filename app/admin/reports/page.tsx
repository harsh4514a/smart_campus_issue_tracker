"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import AdminShell from "@/components/admin/AdminShell";
import { authFetch, loadAuth } from "@/lib/client-auth";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  ListFilter,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  UserCheck,
} from "lucide-react";

type IssueStatus = "Pending" | "In Progress" | "Resolved" | "Rejected";
type IssuePriority = "Low" | "Medium" | "High" | "Urgent";

type Issue = {
  _id: string;
  title: string;
  category: string;
  status: IssueStatus;
  createdAt?: string;
  location?: string;
  priority?: IssuePriority | null;
  student?: { name?: string; email?: string };
  assignedStaff?: { _id?: string; name?: string; email?: string } | null;
  department?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  serviceDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  academicDepartment?: { _id?: string; name?: string; type?: "Academic" | "Service" } | null;
  recurring?: boolean;
};

type DateRangeFilter = "All" | "7d" | "30d" | "90d";
type TableSort = "date_desc" | "date_asc" | "status" | "department" | "priority";

const POLL_INTERVAL_MS = 20000;
const ENABLE_ADMIN_AUTO_REFRESH = false;
const REPORTS_ISSUES_LIMIT = 80;

const LazyAdminReportsCharts = dynamic(
  () => import("@/components/admin/AdminReportsCharts"),
  {
    ssr: false,
    loading: () => <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />,
  }
);

type FeedbackSummary = {
  averageRating: number;
  total: number;
};

type DashboardDataResponse = {
  issues?: Issue[];
  reports?: {
    feedback?: FeedbackSummary;
  };
};

export default function AdminReportsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | IssueStatus | "Assigned">("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("All");
  const [tableSort, setTableSort] = useState<TableSort>("date_desc");
  const [tableSearch, setTableSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary>({ averageRating: 0, total: 0 });
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const tableSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = "Reports | CampusTracker Admin";
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/") {
        const activeTag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;
        event.preventDefault();
        tableSearchRef.current?.focus();
      }

      if (event.key === "Escape" && selectedIssue) {
        setSelectedIssue(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIssue]);

  const scopedIssues = useMemo(() => {
    const startTs = startDate ? new Date(startDate).getTime() : null;
    const endTs = endDate ? new Date(endDate).getTime() : null;

    return issues.filter((issue) => {
      const issueDepartment =
        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";
      const departmentMatch = departmentFilter === "All" ? true : issueDepartment === departmentFilter;
      if (!departmentMatch) return false;

      if (!startTs && !endTs) return true;
      if (!issue.createdAt) return false;
      const createdAt = new Date(issue.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;
      if (startTs && createdAt < startTs) return false;
      if (endTs) {
        const endOfDay = endTs + (24 * 60 * 60 * 1000 - 1);
        if (createdAt > endOfDay) return false;
      }
      return true;
    });
  }, [departmentFilter, endDate, issues, startDate]);

  const load = useCallback(async (silent = false, signal?: AbortSignal) => {
    const auth = loadAuth();
    if (!auth) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await authFetch(
        `/api/dashboard?issuesLimit=${REPORTS_ISSUES_LIMIT}&includeWorkers=0&includeRecentIssues=0&includeNotifications=0`,
        { method: "GET", signal },
        auth.token
      );

      if (signal?.aborted) return;

      const payload = data as DashboardDataResponse;
      const feedback = payload?.reports?.feedback;

      setIssues(Array.isArray(payload?.issues) ? payload.issues.slice(0, REPORTS_ISSUES_LIMIT) : []);
      setFeedbackSummary({
        averageRating: Number(feedback?.averageRating || 0),
        total: Number(feedback?.total || 0),
      });
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load reports");
      }
    } finally {
      if (!silent && !signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);

    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!ENABLE_ADMIN_AUTO_REFRESH) return;

    const auth = loadAuth();
    if (!auth) return;

    let intervalId: number | null = null;
    let activeController: AbortController | null = null;

    const runSilentRefresh = () => {
      activeController?.abort();
      activeController = new AbortController();
      void load(true, activeController.signal);
    };

    const startPolling = () => {
      if (document.hidden || intervalId !== null) return;
      intervalId = window.setInterval(runSilentRefresh, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      activeController?.abort();
      activeController = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      runSilentRefresh();
      startPolling();
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  const summary = useMemo(() => {
    const total = scopedIssues.length;
    const pending = scopedIssues.filter((issue) => issue.status === "Pending").length;
    const inProgress = scopedIssues.filter((issue) => issue.status === "In Progress").length;
    const resolved = scopedIssues.filter((issue) => issue.status === "Resolved").length;
    const assigned = scopedIssues.filter((issue) => Boolean(issue.assignedStaff?._id)).length;
    const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { total, pending, inProgress, resolved, assigned, resolvedRate };
  }, [scopedIssues]);

  const statusDonutData = useMemo(() => {
    const pending = scopedIssues.filter((issue) => issue.status === "Pending").length;
    const inProgress = scopedIssues.filter((issue) => issue.status === "In Progress").length;
    const resolved = scopedIssues.filter((issue) => issue.status === "Resolved").length;
    const rejected = scopedIssues.filter((issue) => issue.status === "Rejected").length;
    const total = Math.max(scopedIssues.length, 1);

    return [
      {
        name: "Pending",
        value: pending,
        renderValue: pending === 0 ? 0.0001 : pending,
        color: "#F59E0B",
        percent: Math.round((pending / total) * 100),
      },
      {
        name: "In Progress",
        value: inProgress,
        renderValue: inProgress === 0 ? 0.0001 : inProgress,
        color: "#2563EB",
        percent: Math.round((inProgress / total) * 100),
      },
      {
        name: "Resolved",
        value: resolved,
        renderValue: resolved === 0 ? 0.0001 : resolved,
        color: "#16A34A",
        percent: Math.round((resolved / total) * 100),
      },
      {
        name: "Rejected",
        value: rejected,
        renderValue: rejected === 0 ? 0.0001 : rejected,
        color: "#DC2626",
        percent: Math.round((rejected / total) * 100),
      },
    ];
  }, [scopedIssues]);

  const departmentChartData = useMemo(() => {
    const map = new Map<string, number>();
    scopedIssues.forEach((issue) => {
      const departmentName =
        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";
      map.set(departmentName, (map.get(departmentName) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [scopedIssues]);

  const activityTrendData = useMemo(() => {
    const dayMap = new Map<string, { date: string; dateTs: number; created: number; resolved: number }>();

    scopedIssues.forEach((issue) => {
      if (!issue.createdAt) return;
      const ts = new Date(issue.createdAt).getTime();
      if (Number.isNaN(ts)) return;
      const dayKey = new Date(ts).toISOString().slice(0, 10);
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { date: dayKey, dateTs: ts, created: 0, resolved: 0 });
      }
      const row = dayMap.get(dayKey);
      if (!row) return;
      row.created += 1;
      if (issue.status === "Resolved") row.resolved += 1;
    });

    return Array.from(dayMap.values()).sort((a, b) => a.dateTs - b.dateTs);
  }, [scopedIssues]);

  const recurringInsights = useMemo(() => {
    const recurringIssues = scopedIssues.filter((issue) => issue.recurring);
    const recurringCount = recurringIssues.length;

    const categoryMap = new Map<string, number>();
    recurringIssues.forEach((issue) => {
      categoryMap.set(issue.category, (categoryMap.get(issue.category) || 0) + 1);
    });

    const topRecurringCategories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { recurringCount, topRecurringCategories };
  }, [scopedIssues]);

  const trendIndicators = useMemo(() => {
    const latest = activityTrendData[activityTrendData.length - 1] || { created: 0, resolved: 0 };
    const previous = activityTrendData[activityTrendData.length - 2] || { created: 0, resolved: 0 };

    const createdTrend = getTrendMeta(latest.created, previous.created);
    const resolvedTrend = getTrendMeta(latest.resolved, previous.resolved);
    const backlogTrend = getTrendMeta(
      latest.created - latest.resolved,
      previous.created - previous.resolved
    );

    return {
      total: createdTrend,
      pending: backlogTrend,
      resolved: resolvedTrend,
    };
  }, [activityTrendData]);

  const dashboardInsights = useMemo(() => {
    const total = summary.total || 1;
    const pendingPercent = Math.round((summary.pending / total) * 100);
    const topDepartment = departmentChartData[0];

    return {
      pendingPercent,
      topDepartmentText: topDepartment
        ? `${topDepartment.department} has the highest workload (${topDepartment.count} issues)`
        : "No department workload data yet",
    };
  }, [departmentChartData, summary.pending, summary.total]);

  const departmentOptions = useMemo(() => {
    const values = new Set<string>();
    issues.forEach((issue) => {
      const departmentName =
        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";
      values.add(departmentName);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [issues]);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    issues.forEach((issue) => values.add(issue.category));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [issues]);

  const filteredTableIssues = useMemo(() => {
    const now = Date.now();
    const dateRangeMs =
      dateRangeFilter === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : dateRangeFilter === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : dateRangeFilter === "90d"
            ? 90 * 24 * 60 * 60 * 1000
            : null;

    const normalizedQuery = tableSearch.trim().toLowerCase();

    const filtered = issues.filter((issue) => {
      const issueDepartment =
        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";

      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Assigned"
            ? issue.status === "Pending" && Boolean(issue.assignedStaff?._id)
            : issue.status === statusFilter;

      const departmentMatch = departmentFilter === "All" ? true : issueDepartment === departmentFilter;
      const categoryMatch = categoryFilter === "All" ? true : issue.category === categoryFilter;

      const dateMatch =
        dateRangeMs === null
          ? true
          : (() => {
              if (!issue.createdAt) return false;
              const createdAt = new Date(issue.createdAt).getTime();
              if (Number.isNaN(createdAt)) return false;
              return now - createdAt <= dateRangeMs;
            })();

      const queryMatch =
        !normalizedQuery ||
        [issue.title, issue.category, issue.student?.name, issue.student?.email, issueDepartment]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return statusMatch && departmentMatch && categoryMatch && dateMatch && queryMatch;
    });

    return filtered.sort((a, b) => {
      if (tableSort === "date_desc") {
        return (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0);
      }

      if (tableSort === "date_asc") {
        return (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0);
      }

      if (tableSort === "status") {
        return getIssueStatusRank(a) - getIssueStatusRank(b);
      }

      if (tableSort === "department") {
        const aDepartment = a.serviceDepartment?.name || a.academicDepartment?.name || a.department?.name || "Unassigned";
        const bDepartment = b.serviceDepartment?.name || b.academicDepartment?.name || b.department?.name || "Unassigned";
        return aDepartment.localeCompare(bDepartment);
      }

      const priorityRank: Record<string, number> = { Low: 1, Medium: 2, High: 3, Urgent: 4 };
      const aRank = priorityRank[a.priority || "Medium"] || 0;
      const bRank = priorityRank[b.priority || "Medium"] || 0;
      return bRank - aRank;
    });
  }, [statusFilter, departmentFilter, categoryFilter, dateRangeFilter, tableSearch, tableSort, issues]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTableIssues.length / pageSize));
  }, [filteredTableIssues.length, pageSize]);

  const effectiveCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTableIssues = useMemo(() => {
    const start = (effectiveCurrentPage - 1) * pageSize;
    return filteredTableIssues.slice(start, start + pageSize);
  }, [filteredTableIssues, effectiveCurrentPage, pageSize]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: "status" | "department" | "category" | "dateRange" | "search"; label: string }> = [];
    if (statusFilter !== "All") chips.push({ key: "status", label: `Status: ${statusFilter}` });
    if (departmentFilter !== "All") chips.push({ key: "department", label: `Department: ${departmentFilter}` });
    if (categoryFilter !== "All") chips.push({ key: "category", label: `Category: ${categoryFilter}` });
    if (dateRangeFilter !== "All") chips.push({ key: "dateRange", label: `Date: ${dateRangeFilter}` });
    if (tableSearch.trim()) chips.push({ key: "search", label: `Search: ${tableSearch.trim()}` });
    return chips;
  }, [categoryFilter, dateRangeFilter, departmentFilter, statusFilter, tableSearch]);

  const clearFilterChip = useCallback((key: "status" | "department" | "category" | "dateRange" | "search") => {
    if (key === "status") setStatusFilter("All");
    if (key === "department") setDepartmentFilter("All");
    if (key === "category") setCategoryFilter("All");
    if (key === "dateRange") setDateRangeFilter("All");
    if (key === "search") setTableSearch("");
    setCurrentPage(1);
  }, []);

  const resetAllFilters = useCallback(() => {
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10));
    setStatusFilter("All");
    setDepartmentFilter("All");
    setCategoryFilter("All");
    setDateRangeFilter("All");
    setTableSearch("");
    setTableSort("date_desc");
    setCurrentPage(1);
  }, []);

  return (
    <AdminProtected>
      <AdminShell title="Reports" subtitle="Professional reporting dashboard for issue operations">
        <div className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {error && <div className="text-sm text-red-600">{error}</div>}

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500" />
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500" />
                  <select value={departmentFilter} onChange={(event) => {
                    setDepartmentFilter(event.target.value);
                    setCurrentPage(1);
                  }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500">
                    <option value="All">All Departments</option>
                    {departmentOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={resetAllFilters} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeFilterChips.length > 0 ? (
                    <>
                      <span className="text-xs font-semibold text-slate-500">Filters applied:</span>
                      {activeFilterChips.map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={() => clearFilterChip(chip.key)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {chip.label} ×
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">No filters applied</span>
                  )}
                </div>
              </section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  label="Total Reports"
                  value={statsNumber(summary.total)}
                  tone="blue"
                  Icon={FileText}
                  trend={trendIndicators.total}
                />
                <SummaryCard
                  label="Pending"
                  value={statsNumber(summary.pending)}
                  tone="orange"
                  Icon={Clock3}
                  trend={trendIndicators.pending}
                />
                <SummaryCard
                  label="Resolved"
                  value={statsNumber(summary.resolved)}
                  tone="green"
                  Icon={CheckCircle2}
                  trend={trendIndicators.resolved}
                />
                <SummaryCard label="Resolved Rate" value={`${summary.resolvedRate}%`} tone="green" Icon={Sparkles} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard label="In Progress" value={statsNumber(summary.inProgress)} tone="purple" Icon={LoaderCircle} />
                <SummaryCard label="Assigned" value={statsNumber(summary.assigned)} tone="indigo" Icon={UserCheck} />
                <SummaryCard
                  label="Avg Feedback"
                  value={feedbackSummary.total > 0 ? `${feedbackSummary.averageRating.toFixed(1)} / 5` : "—"}
                  tone="blue"
                  Icon={Sparkles}
                  subLabel={`${feedbackSummary.total} response${feedbackSummary.total === 1 ? "" : "s"}`}
                />
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Recurring Issue Insights</h2>
                <p className="mt-1 text-sm text-slate-600">{recurringInsights.recurringCount} recurring issue{recurringInsights.recurringCount === 1 ? "" : "s"} detected</p>
                {recurringInsights.topRecurringCategories.length > 0 ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {recurringInsights.topRecurringCategories.map((item) => (
                      <div key={item.category} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{item.category}</p>
                        <p className="text-xs text-slate-500">{item.count} recurring report{item.count === 1 ? "" : "s"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No recurring patterns yet.</p>
                )}
              </section>

              <LazyAdminReportsCharts
                summaryTotal={summary.total}
                summaryResolved={summary.resolved}
                statusDonutData={statusDonutData}
                departmentChartData={departmentChartData}
                activityTrendData={activityTrendData}
                dashboardInsights={dashboardInsights}
                onStatusSelect={(statusValue) => {
                  setStatusFilter(statusValue);
                  setCurrentPage(1);
                }}
                onDepartmentSelect={(departmentValue) => {
                  setDepartmentFilter(departmentValue);
                  setCurrentPage(1);
                }}
                onDateSelect={(dateValue) => {
                  setStartDate(dateValue);
                  setEndDate(dateValue);
                }}
              />

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-900">Recent Reports</h2>
                </div>

                <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <ListFilter size={14} />
                    Quick Filters
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-500">Search</span>
                      <input
                        ref={tableSearchRef}
                        value={tableSearch}
                        onChange={(event) => {
                          setTableSearch(event.target.value);
                          setCurrentPage(1);
                        }}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                        placeholder="Search reports..."
                      />
                    </label>
                    <FilterSelect
                      label="Status"
                      value={statusFilter}
                      onChange={(value) => {
                        setStatusFilter(value as "All" | IssueStatus | "Assigned");
                        setCurrentPage(1);
                      }}
                      options={[
                        { label: "All", value: "All" },
                        { label: "Pending", value: "Pending" },
                        { label: "Assigned", value: "Assigned" },
                        { label: "In Progress", value: "In Progress" },
                        { label: "Resolved", value: "Resolved" },
                        { label: "Rejected", value: "Rejected" },
                      ]}
                    />
                    <FilterSelect
                      label="Department"
                      value={departmentFilter}
                      onChange={(value) => {
                        setDepartmentFilter(value);
                        setCurrentPage(1);
                      }}
                      options={[{ label: "All", value: "All" }, ...departmentOptions.map((name) => ({ label: name, value: name }))]}
                    />
                    <FilterSelect
                      label="Category"
                      value={categoryFilter}
                      onChange={(value) => {
                        setCategoryFilter(value);
                        setCurrentPage(1);
                      }}
                      options={[{ label: "All", value: "All" }, ...categoryOptions.map((name) => ({ label: name, value: name }))]}
                    />
                    <FilterSelect
                      label="Date Range"
                      value={dateRangeFilter}
                      onChange={(value) => {
                        setDateRangeFilter(value as DateRangeFilter);
                        setCurrentPage(1);
                      }}
                      options={[
                        { label: "All", value: "All" },
                        { label: "Last 7 days", value: "7d" },
                        { label: "Last 30 days", value: "30d" },
                        { label: "Last 90 days", value: "90d" },
                      ]}
                    />
                    <FilterSelect
                      label="Sort"
                      value={tableSort}
                      onChange={(value) => {
                        setTableSort(value as TableSort);
                        setCurrentPage(1);
                      }}
                      options={[
                        { label: "Newest First", value: "date_desc" },
                        { label: "Oldest First", value: "date_asc" },
                        { label: "Status", value: "status" },
                        { label: "Department", value: "department" },
                        { label: "Priority", value: "priority" },
                      ]}
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={resetAllFilters}
                    >
                      <RefreshCcw size={14} />
                      Reset Filters
                    </button>
                  </div>
                </div>

                <table className="min-w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <Th>Title</Th>
                      <Th>Category</Th>
                      <Th>Department</Th>
                      <Th>Priority</Th>
                      <Th>Status</Th>
                      <Th>Reported By</Th>
                      <Th>Date</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTableIssues.map((issue) => {
                      const departmentName =
                        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";

                      return (
                        <tr key={issue._id} className="cursor-pointer border-t border-slate-100 transition hover:bg-gray-50">
                          <Td className="font-semibold text-slate-800">
                            <button
                              type="button"
                              onClick={() => setSelectedIssue(issue)}
                              className="text-left text-teal-700 hover:underline"
                            >
                              {issue.title}
                            </button>
                            {issue.recurring ? (
                              <span className="mt-1 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                Recurring
                              </span>
                            ) : null}
                          </Td>
                          <Td>{issue.category}</Td>
                          <Td>{departmentName}</Td>
                          <Td>
                            <PriorityBadge priority={issue.priority || null} />
                          </Td>
                          <Td>
                            <StatusBadge status={issue.status} isAssigned={Boolean(issue.assignedStaff?._id)} />
                          </Td>
                          <Td>
                            {issue.student?.name || "Unknown"}
                            {issue.student?.email ? ` (${issue.student.email})` : ""}
                          </Td>
                          <Td>{formatDate(issue.createdAt)}</Td>
                          <Td>
                            <div className="flex items-center gap-1">
                              <IconActionButton label="View" onClick={() => setSelectedIssue(issue)}>
                                <Eye size={14} />
                              </IconActionButton>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                    {filteredTableIssues.length === 0 && (
                      <tr>
                        <Td colSpan={8} className="py-10 text-center text-slate-500">
                          {issues.length === 0 ? "No data available" : "No results found"}
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {!loading && (
                  <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing {filteredTableIssues.length === 0 ? 0 : (effectiveCurrentPage - 1) * pageSize + 1}
                      -{Math.min(effectiveCurrentPage * pageSize, filteredTableIssues.length)} of {filteredTableIssues.length} filtered reports ({issues.length} total)
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={String(pageSize)}
                        onChange={(event) => {
                          const nextPageSize = Number(event.target.value);
                          setPageSize(nextPageSize > 20 ? 20 : nextPageSize);
                          setCurrentPage(1);
                        }}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
                      >
                        <option value="10">10 / page</option>
                        <option value="20">20 / page</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={effectiveCurrentPage === 1}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">Page {effectiveCurrentPage} of {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={effectiveCurrentPage >= totalPages}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </AdminShell>

      {selectedIssue && (
        <IssueDetailModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
      )}
    </AdminProtected>
  );
}

const SummaryCard = memo(function SummaryCard({
  label,
  value,
  tone,
  Icon,
  trend,
  subLabel,
}: {
  label: string;
  value: string;
  tone: "blue" | "orange" | "purple" | "green" | "indigo";
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: TrendMeta;
  subLabel?: string;
}) {
  const toneClass: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:scale-[1.01] hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{value}</p>
      {subLabel ? <p className="mt-1 text-xs font-medium text-slate-500">{subLabel}</p> : null}
      {trend && trend.label && (
        <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trend.textClass}`}>
          {trend.direction === "up" ? <ArrowUp size={12} /> : trend.direction === "down" ? <ArrowDown size={12} /> : <ArrowRight size={12} />}
          {trend.label}
        </div>
      )}
    </div>
  );
});

const FilterSelect = memo(function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});

const StatusBadge = memo(function StatusBadge({ status, isAssigned }: { status: IssueStatus; isAssigned: boolean }) {
  if (status === "Rejected") {
    return <Badge label="Rejected" className="bg-red-100 text-red-700" />;
  }

  if (status === "Resolved") {
    return <Badge label="Resolved" className="bg-green-100 text-green-700" />;
  }

  if (status === "In Progress") {
    return <Badge label="In Progress" className="bg-blue-100 text-blue-700" />;
  }

  if (isAssigned) {
    return <Badge label="Assigned" className="bg-blue-100 text-blue-700" />;
  }

  return <Badge label="Pending" className="bg-amber-100 text-amber-700" />;
});

const PriorityBadge = memo(function PriorityBadge({ priority }: { priority: IssuePriority | null }) {
  if (!priority) {
    return <Badge label="—" className="bg-slate-100 text-slate-600" />;
  }

  if (priority === "Low") {
    return <Badge label="Low" className="bg-slate-100 text-slate-700" />;
  }

  if (priority === "Medium") {
    return <Badge label="Medium" className="bg-amber-100 text-amber-700" />;
  }

  if (priority === "High") {
    return <Badge label="High" className="bg-orange-100 text-orange-700" />;
  }

  return <Badge label={priority} className="bg-red-100 text-red-700" />;
});

const Badge = memo(function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
});

function IssueDetailModal({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const isAssigned = Boolean(issue.assignedStaff?._id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">Issue Details</h3>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={issue.status} isAssigned={isAssigned} />
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issue Title</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{issue.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                Category: {issue.category}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <DetailItem label="Status">
              <StatusBadge status={issue.status} isAssigned={isAssigned} />
            </DetailItem>
            <DetailItem label="Priority">
              <PriorityBadge priority={issue.priority || null} />
            </DetailItem>
            <DetailItem label="Reported By">{issue.student?.name || "Unknown"}</DetailItem>
            <DetailItem label="Assigned Staff">{issue.assignedStaff?.name || "Unassigned"}</DetailItem>
            <DetailItem label="Location">{issue.location || "—"}</DetailItem>
            <DetailItem label="Created">{formatDate(issue.createdAt)}</DetailItem>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-base text-slate-800">{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}

const IconActionButton = memo(function IconActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
      aria-label={label}
    >
      {children}
    </button>
  );
});

const Th = memo(function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">{children}</th>;
});

const Td = memo(function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 text-sm text-slate-600 ${className}`}>
      {children}
    </td>
  );
});

function statsNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type TrendMeta = {
  direction: "up" | "down" | "flat";
  label: string;
  textClass: string;
};

function getTrendMeta(current: number, previous: number): TrendMeta {
  const delta = current - previous;
  if (current === 0 && previous === 0) {
    return { direction: "flat", label: "", textClass: "text-slate-500" };
  }

  if (current > previous) {
    return { direction: "up", label: `+${delta} vs last month`, textClass: "text-emerald-600" };
  }

  if (current < previous) {
    return { direction: "down", label: `${delta} vs last month`, textClass: "text-rose-600" };
  }

  return { direction: "flat", label: "same as last month", textClass: "text-slate-500" };
}

function getIssueStatusRank(issue: Issue) {
  if (issue.status === "Pending" && !issue.assignedStaff?._id) return 1;
  if (issue.status === "Pending" && issue.assignedStaff?._id) return 2;
  if (issue.status === "In Progress") return 3;
  if (issue.status === "Resolved") return 4;
  return 5;
}
