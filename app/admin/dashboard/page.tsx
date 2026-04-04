"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminProtected from "@/components/AdminProtected";
import { authFetch, loadAuth } from "@/lib/client-auth";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  RefreshCcw,
  UserCheck,
  Users2,
  Users,
} from "lucide-react";

type Stats = {
  students: number;
  faculty: number;
  staff: number;
  departments: number;
  issues: number;
  pending: number;
  inProgress: number;
  assigned: number;
  resolved: number;
  needsAttention?: {
    unassigned: number;
    overdue: number;
    recurring?: number;
  };
  insights?: {
    topDepartment: { name: string; count: number } | null;
  };
  trends?: {
    pending?: { current: number; previous: number; direction: "up" | "down" | "flat" };
    resolved?: { current: number; previous: number; direction: "up" | "down" | "flat" };
  };
};

type AdminIssue = {
  _id: string;
  title: string;
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  createdAt?: string;
  updatedAt?: string;
  student?: { name?: string };
  assignedStaff?: { _id?: string; name?: string } | null;
};

type TrendMeta = {
  direction: "up" | "down" | "flat";
  delta: number;
  label: string;
  className: string;
};

type FeedbackSummary = {
  averageRating: number;
  total: number;
};

type DashboardDataResponse = {
  stats: Stats;
  issues?: AdminIssue[];
  recentIssues?: AdminIssue[];
  notifications?: Array<{
    id: string;
    issueId: string;
    message: string;
    tone: "green" | "indigo" | "teal";
    timestamp: string | null;
  }>;
  reports?: {
    feedback?: FeedbackSummary;
  };
};

type ActivityItem = {
  id: string;
  iconTone: "green" | "indigo" | "teal";
  message: string;
  timestamp: string;
  happenedAt: number | null;
};

const POLL_INTERVAL_MS = 20000;
const ENABLE_ADMIN_AUTO_REFRESH = false;
const DASHBOARD_RECENT_ISSUES_LIMIT = 10;
const DASHBOARD_NOTIFICATIONS_LIMIT = 10;
const MAX_ACTIVITY_ITEMS = 5;

export default function AdminDashboard() {
  const auth = useMemo(() => loadAuth(), []);
  const isSuperAdmin = auth?.user?.adminRole === "super_admin";
  const cacheKey = "scit_admin_dashboard_data";
  const cacheTtlMs = 2 * 60 * 1000;
  const cachedDashboard = useMemo(
    () => readCachedDashboard(cacheKey, cacheTtlMs),
    [cacheKey, cacheTtlMs]
  );
  const [stats, setStats] = useState<Stats | null>(() => cachedDashboard?.stats || null);
  const [recentIssues, setRecentIssues] = useState<AdminIssue[]>(
    () => cachedDashboard?.recentIssues || []
  );
  const [notifications, setNotifications] = useState<DashboardDataResponse["notifications"]>(
    () => cachedDashboard?.notifications || []
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !cachedDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary>(
    () => cachedDashboard?.feedbackSummary || { averageRating: 0, total: 0 }
  );
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = "Dashboard | CampusTracker Admin";
  }, []);

  const loadDashboardData = useCallback(async (silent = false, signal?: AbortSignal) => {
    const activeAuth = loadAuth();
    if (!activeAuth) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await authFetch(
        `/api/dashboard?includeIssues=0&includeWorkers=0&recentIssuesLimit=${DASHBOARD_RECENT_ISSUES_LIMIT}&notificationsLimit=${DASHBOARD_NOTIFICATIONS_LIMIT}`,
        { method: "GET", signal },
        activeAuth.token
      );

      if (signal?.aborted) return;

      const payload = data as DashboardDataResponse;
      const statsData = payload?.stats || null;
      const latestRecentIssues = Array.isArray(payload?.recentIssues)
        ? payload.recentIssues.slice(0, DASHBOARD_RECENT_ISSUES_LIMIT)
        : Array.isArray(payload?.issues)
          ? payload.issues.slice(0, DASHBOARD_RECENT_ISSUES_LIMIT)
          : [];
      const latestNotifications = Array.isArray(payload?.notifications)
        ? payload.notifications.slice(0, DASHBOARD_NOTIFICATIONS_LIMIT)
        : [];
      const feedback = payload?.reports?.feedback;

      if (statsData) {
        setStats(statsData);
      }

      setRecentIssues(latestRecentIssues);
      setNotifications(latestNotifications);
      setFeedbackSummary({
        averageRating: Number(feedback?.averageRating || 0),
        total: Number(feedback?.total || 0),
      });
      setLastUpdatedAt(Date.now());
      if (statsData) {
        writeCachedDashboard(cacheKey, {
          stats: statsData,
          recentIssues: latestRecentIssues,
          notifications: latestNotifications,
          feedbackSummary: {
            averageRating: Number(feedback?.averageRating || 0),
            total: Number(feedback?.total || 0),
          },
        });
      }
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      if (!silent) {
        setError((err as { message?: string })?.message || "Failed to load stats");
      }
    } finally {
      if (!silent && !signal?.aborted) {
        setLoading(false);
      }
    }
  }, [cacheKey]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboardData(false, controller.signal);

    return () => controller.abort();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!ENABLE_ADMIN_AUTO_REFRESH || !auth) return;

    let intervalId: number | null = null;

    const runSilentRefresh = () => {
      const controller = new AbortController();
      void loadDashboardData(true, controller.signal);
      return controller;
    };

    let activeController: AbortController | null = null;

    const startPolling = () => {
      if (document.hidden || intervalId !== null) return;
      intervalId = window.setInterval(() => {
        activeController?.abort();
        activeController = runSilentRefresh();
      }, POLL_INTERVAL_MS);
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

      activeController?.abort();
      activeController = runSilentRefresh();
      startPolling();
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [auth, loadDashboardData]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const onRefreshNow = useCallback(() => {
    setRefreshing(true);
    const controller = new AbortController();
    void loadDashboardData(true, controller.signal).finally(() => {
      refreshTimeoutRef.current = window.setTimeout(() => setRefreshing(false), 500);
    });
  }, [loadDashboardData]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return "Not synced yet";
    const minutesAgo = getMinutesSince(lastUpdatedAt);
    if (minutesAgo < 1) return "Updated just now";
    if (minutesAgo < 60) return `Updated ${minutesAgo}m ago`;
    return `Updated ${Math.floor(minutesAgo / 60)}h ago`;
  }, [lastUpdatedAt]);

  const trendData = useMemo(() => {
    return {
      total: { direction: "flat" as const, delta: 0, label: "", className: "text-slate-500" },
      pending: toTrendMeta(stats?.trends?.pending?.current, stats?.trends?.pending?.previous),
      assigned: { direction: "flat" as const, delta: 0, label: "", className: "text-slate-500" },
      inProgress: { direction: "flat" as const, delta: 0, label: "", className: "text-slate-500" },
      resolved: toTrendMeta(stats?.trends?.resolved?.current, stats?.trends?.resolved?.previous),
    };
  }, [stats]);

  const metricCards = useMemo(
    () => [
      { label: "Total Issues", value: stats?.issues ?? 0, tone: "teal" as const, Icon: FileText, trend: trendData.total, href: "/admin/issues" },
      { label: "Pending", value: stats?.pending ?? 0, tone: "amber" as const, Icon: Clock3, trend: trendData.pending, href: "/admin/issues?status=Pending" },
      { label: "Active Assignments", value: stats?.assigned ?? 0, tone: "indigo" as const, Icon: UserCheck, trend: trendData.assigned, href: "/admin/issues?status=Assigned" },
      {
        label: "In Progress Issues",
        value: stats?.inProgress ?? 0,
        tone: "purple" as const,
        Icon: LoaderCircle,
        trend: trendData.inProgress,
        href: "/admin/issues?status=In%20Progress",
      },
      { label: "Resolved", value: stats?.resolved ?? 0, tone: "green" as const, Icon: CheckCircle2, trend: trendData.resolved, href: "/admin/issues?status=Resolved" },
    ],
    [stats, trendData]
  );

  const prominentMetrics = useMemo(() => metricCards.filter((card) => card.value > 0), [metricCards]);

  const needsAttention = useMemo(
    () => ({
      unassigned: stats?.needsAttention?.unassigned ?? 0,
      overdue: stats?.needsAttention?.overdue ?? 0,
      recurring: stats?.needsAttention?.recurring ?? 0,
    }),
    [stats]
  );

  const hasAttentionItems = needsAttention.unassigned > 0 || needsAttention.overdue > 0 || needsAttention.recurring > 0;

  const totalIssueCount = stats?.issues ?? recentIssues.length;
  const resolutionRate = totalIssueCount > 0 ? Math.round(((stats?.resolved ?? 0) / totalIssueCount) * 100) : 0;
  const assignedCoverage =
    totalIssueCount > 0
      ? Math.round(((stats?.assigned ?? 0) / totalIssueCount) * 100)
      : 0;
  const attentionLoad =
    totalIssueCount > 0
      ? Math.round(((needsAttention.unassigned + needsAttention.overdue) / totalIssueCount) * 100)
      : 0;

  const directoryCards = useMemo(
    () => [
      { label: "Students", value: stats?.students ?? 0, href: "/admin/students", Icon: Users },
      { label: "Staff", value: stats?.staff ?? 0, href: "/admin/staff", Icon: Users2 },
      { label: "Departments", value: stats?.departments ?? 0, href: "/admin/departments", Icon: Building2 },
      { label: "Faculty", value: stats?.faculty ?? 0, href: "/admin/staff", Icon: UserCheck },
    ],
    [stats]
  );

  const topResolver = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const map = new Map<string, number>();

    recentIssues.forEach((issue) => {
      if (issue.status !== "Resolved") return;
      const resolvedAt = toTimestamp(issue.updatedAt || issue.createdAt);
      if (resolvedAt === null || resolvedAt < monthStart) return;
      const assignee = issue.assignedStaff?.name || "Unassigned";
      map.set(assignee, (map.get(assignee) || 0) + 1);
    });

    const [name, count] = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] || [];
    if (!name || !count) return null;
    return { name, count };
  }, [recentIssues]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const feed = notifications || [];

    if (feed.length > 0) {
      return feed.slice(0, MAX_ACTIVITY_ITEMS).map((item) => {
        const eventTime = toTimestamp(item.timestamp);
        return {
          id: item.issueId,
          iconTone: item.tone,
          message: item.message,
          timestamp: formatRelativeTime(eventTime),
          happenedAt: eventTime,
        };
      });
    }

    return recentIssues
      .slice()
      .sort((a, b) => (toTimestamp(b.updatedAt || b.createdAt) || 0) - (toTimestamp(a.updatedAt || a.createdAt) || 0))
      .slice(0, MAX_ACTIVITY_ITEMS)
      .map((issue) => {
        const issueTitle = issue.title || "Untitled issue";
        const eventTime = toTimestamp(issue.updatedAt || issue.createdAt);

        if (issue.status === "Resolved") {
          return {
            id: issue._id,
            iconTone: "green",
            message: `${issueTitle} - resolved by ${issue.assignedStaff?.name || "staff"}`,
            timestamp: formatRelativeTime(eventTime),
            happenedAt: eventTime,
          };
        }

        if (issue.assignedStaff?.name) {
          return {
            id: issue._id,
            iconTone: "indigo",
            message: `${issueTitle} - assigned by admin to ${issue.assignedStaff.name}`,
            timestamp: formatRelativeTime(eventTime),
            happenedAt: eventTime,
          };
        }

        return {
          id: issue._id,
          iconTone: "teal",
          message: `${issueTitle} - reported by ${issue.student?.name || "student"}`,
          timestamp: formatRelativeTime(eventTime),
          happenedAt: eventTime,
        };
      });
  }, [notifications, recentIssues]);

  const groupedActivity = useMemo(() => {
    const today: ActivityItem[] = [];
    const yesterday: ActivityItem[] = [];
    const older: ActivityItem[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    for (const item of recentActivity) {
      const ts = item.happenedAt;
      if (!ts) {
        older.push(item);
      } else if (ts >= todayStart) {
        today.push(item);
      } else if (ts >= yesterdayStart) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    }

    return { today, yesterday, older };
  }, [recentActivity]);

  const exportMonthlyReport = (format: "csv" | "pdf") => {
    if (!stats) return;

    if (format === "pdf") {
      window.print();
      return;
    }

    const rows = [
      ["Metric", "Value"],
      ["Total Issues", String(stats.issues)],
      ["Pending", String(stats.pending)],
      ["Assigned", String(stats.assigned)],
      ["In Progress", String(stats.inProgress)],
      ["Resolved", String(stats.resolved)],
      ["Unassigned", String(needsAttention.unassigned)],
      ["Overdue", String(needsAttention.overdue)],
      ["Top Department", stats.insights?.topDepartment?.name || "-"] ,
      ["Top Resolver", topResolver ? `${topResolver.name} (${topResolver.count})` : "-"] ,
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `CampusTracker-monthly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminProtected>
      <AdminShell
        title="Admin Dashboard"
        subtitle="Overview of campus issue tracking system"
        headerActions={
          <div className="flex items-center gap-2">
            <span className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 sm:inline-flex">
              {lastUpdatedLabel}
            </span>
            <button
              type="button"
              onClick={onRefreshNow}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCcw className={`h-4 w-4 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => exportMonthlyReport("csv")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-4 w-4 text-teal-600" />
              Export Monthly Report
            </button>
          </div>
        }
      >
        <div className="space-y-5">

          {loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="skeleton-shimmer h-24 rounded-xl border border-slate-200 bg-white" />
                ))}
              </div>
              <div className="skeleton-shimmer h-44 rounded-xl border border-slate-200 bg-white" />
            </div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}

          {stats && (
            <>
              {prominentMetrics.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {prominentMetrics.map((card) => (
                    <StatCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      tone={card.tone}
                      Icon={card.Icon}
                      trend={card.trend}
                      href={card.href}
                    />
                  ))}
                </div>
              )}

              {prominentMetrics.length === 0 && (
                <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
                  No issues reported yet
                </section>
              )}
            </>
          )}

          {stats && (
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Resolution Rate</p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{resolutionRate}%</p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${getMeterTone(resolutionRate, false)}`} style={{ width: `${Math.min(resolutionRate, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Closed out of total issues</p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Assignment Coverage</p>
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{assignedCoverage}%</p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${getMeterTone(assignedCoverage, false)}`} style={{ width: `${Math.min(assignedCoverage, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Issues currently assigned to staff</p>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Attention Load</p>
                  <BarChart3 className="h-4 w-4 text-rose-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{attentionLoad}%</p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${getMeterTone(attentionLoad, true)}`} style={{ width: `${Math.min(attentionLoad, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Share of issues that are overdue or unassigned</p>
              </article>
            </section>
          )}

          {stats && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Directory Snapshot</h2>
                <span className="text-xs font-medium text-slate-500">Live campus inventory</span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {directoryCards.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50/40"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-600">{item.label}</p>
                      <item.Icon className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {stats && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Recent Activity</h2>
              <div className="space-y-3">
                {groupedActivity.today.length === 0 && groupedActivity.yesterday.length === 0 && groupedActivity.older.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity yet.</p>
                ) : null}

                {groupedActivity.today.length > 0 ? (
                  <ActivityGroup title="Today" items={groupedActivity.today} />
                ) : null}
                {groupedActivity.yesterday.length > 0 ? (
                  <ActivityGroup title="Yesterday" items={groupedActivity.yesterday} />
                ) : null}
                {groupedActivity.older.length > 0 ? (
                  <ActivityGroup title="Earlier" items={groupedActivity.older} />
                ) : null}

                {recentIssues.length > 5 ? (
                  <div className="pt-1 text-right">
                    <Link href="/admin/issues" className="text-xs font-semibold text-teal-700 hover:underline">View All</Link>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {stats && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">
                Most reported department: {stats.insights?.topDepartment?.name || "—"}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Top resolver this month: {topResolver ? `${topResolver.name} — ${topResolver.count} issues resolved` : "—"}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Feedback rating: {feedbackSummary.averageRating > 0 ? `${feedbackSummary.averageRating.toFixed(1)} / 5` : "—"}
                {` `}
                ({feedbackSummary.total} response{feedbackSummary.total === 1 ? "" : "s"})
              </p>
            </section>
          )}

          {stats && (
            <>
              {hasAttentionItems ? (
                <section className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <h2 className="text-base font-semibold text-rose-800">Needs Attention</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Link
                      href="/admin/issues?status=Unassigned"
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
                    >
                      <p className="text-sm font-medium text-slate-500">Unassigned Issues</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{needsAttention.unassigned}</p>
                    </Link>
                    <Link
                      href="/admin/issues?status=Overdue"
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
                    >
                      <p className="text-sm font-medium text-slate-500">Overdue Issues</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{needsAttention.overdue}</p>
                    </Link>
                    <Link
                      href="/admin/reports"
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm"
                    >
                      <p className="text-sm font-medium text-slate-500">Recurring Issues</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{needsAttention.recurring}</p>
                    </Link>
                  </div>
                </section>
              ) : (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Check className="h-4 w-4" />
                    <p className="text-sm font-semibold">All issues are assigned and on track</p>
                  </div>
                </section>
              )}
            </>
          )}

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-4">
              <QuickAction
                href="/admin/issues?status=Unassigned"
                label="Assign Issues"
                Icon={ClipboardList}
                badgeCount={needsAttention.unassigned}
                disabled={needsAttention.unassigned === 0}
              />
              <QuickAction
                href="/admin/issues?status=Overdue"
                label="Overdue Queue"
                Icon={Clock3}
                badgeCount={needsAttention.overdue}
                disabled={needsAttention.overdue === 0}
              />
              {isSuperAdmin ? <QuickAction href="/admin/departments" label="Manage Departments" Icon={Building2} /> : null}
              {isSuperAdmin ? <QuickAction href="/admin/staff" label="Manage Staff" Icon={Users2} /> : null}
            </div>
          </section>
        </div>
      </AdminShell>
    </AdminProtected>
  );
}

function getMinutesSince(timestampMs: number) {
  return Math.max(0, Math.floor((Date.now() - timestampMs) / 60000));
}

const StatCard = memo(function StatCard({
  label,
  value,
  tone,
  Icon,
  trend,
  href,
}: {
  label: string;
  value: number;
  tone: "teal" | "amber" | "green" | "blue" | "purple" | "orange" | "indigo";
  Icon: React.ComponentType<{ className?: string }>;
  trend: TrendMeta;
  href: string;
}) {
  const toneClasses: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <Link href={href} title={`${label}: ${value}`} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm min-h-24 transition hover:scale-[1.01] hover:shadow-md">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-3xl leading-none font-semibold text-gray-900">{value}</p>
        {trend.label ? (
          <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trend.className}`}>
            {trend.direction === "up" ? <ArrowUp className="h-3 w-3" /> : null}
            {trend.direction === "down" ? <ArrowDown className="h-3 w-3" /> : null}
            {trend.direction === "flat" ? <span className="inline-block text-sm leading-none">-</span> : null}
            {trend.label}
          </div>
        ) : null}
      </div>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </Link>
  );
});

const QuickAction = memo(function QuickAction({
  href,
  label,
  Icon,
  badgeCount,
  disabled,
  asButton,
  onClick,
}: {
  href?: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  disabled?: boolean;
  asButton?: boolean;
  onClick?: () => void;
}) {
  const className =
    `rounded-xl border border-slate-200 bg-white px-5 py-5 flex flex-col items-center justify-center text-sm font-semibold text-gray-900 gap-2 min-h-24 transition hover:scale-[1.01] hover:shadow-md ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"}`;

  if (asButton) {
    return (
      <button type="button" onClick={onClick} className={className} disabled={disabled}>
        <Icon className="h-6 w-6 text-teal-600" />
        <span>{label}</span>
        {typeof badgeCount === "number" ? (
          badgeCount > 0 ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">{badgeCount}</span>
          ) : (
            <span className="text-xs text-slate-400">0</span>
          )
        ) : null}
      </button>
    );
  }

  return (
    <Link href={disabled ? "#" : href || "#"} className={className} aria-disabled={disabled} onClick={(event) => {
      if (disabled) event.preventDefault();
    }}>
      <Icon className="h-6 w-6 text-teal-600" />
      <span>{label}</span>
      {typeof badgeCount === "number" ? (
        badgeCount > 0 ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">{badgeCount}</span>
        ) : (
          <span className="text-xs text-slate-400">0</span>
        )
      ) : null}
    </Link>
  );
});

function toTrendMeta(current?: number, previous?: number): TrendMeta {
  const safeCurrent = Number(current || 0);
  const safePrevious = Number(previous || 0);
  const delta = safeCurrent - safePrevious;

  if (safeCurrent === 0 && safePrevious === 0) {
    return { direction: "flat", delta: 0, label: "", className: "text-slate-500" };
  }

  if (delta > 0) {
    return { direction: "up", delta, label: `+${delta} vs last month`, className: "text-emerald-600" };
  }

  if (delta < 0) {
    return { direction: "down", delta, label: `${delta} vs last month`, className: "text-rose-600" };
  }

  return { direction: "flat", delta, label: "same as last month", className: "text-slate-500" };
}

const ActivityGroup = memo(function ActivityGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; iconTone: "green" | "indigo" | "teal"; message: string; timestamp: string }>;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <ActivityDot tone={item.iconTone} />
            <div>
              <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                item.iconTone === "green"
                  ? "bg-green-100 text-green-700"
                  : item.iconTone === "indigo"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-700"
              }`}>
                {item.iconTone === "green" ? "Resolved" : item.iconTone === "indigo" ? "Assigned" : "Reported"}
              </span>
              <Link href={`/admin/issues?issueId=${item.id}`} className="text-sm text-slate-800 hover:text-teal-700 hover:underline">
                {item.message}
              </Link>
              <p className="text-xs text-slate-500">{item.timestamp}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

function toTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return null;
  return date;
}

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) return "just now";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const ActivityDot = memo(function ActivityDot({ tone }: { tone: "teal" | "indigo" | "green" }) {
  const toneClass = {
    teal: "bg-teal-100 text-teal-700",
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-green-100 text-green-700",
  };

  const icon =
    tone === "green" ? <CheckCircle2 className="h-4 w-4" /> : tone === "indigo" ? <UserCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />;

  return <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${toneClass[tone]}`}>{icon}</span>;
});

function readCachedDashboard(key: string, ttlMs: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      stats: Stats;
      recentIssues: AdminIssue[];
      notifications: DashboardDataResponse["notifications"];
      feedbackSummary: FeedbackSummary;
    };
    if (!parsed.timestamp || !parsed.stats) return null;
    if (Date.now() - parsed.timestamp > ttlMs) return null;
    return {
      stats: parsed.stats,
      recentIssues: Array.isArray(parsed.recentIssues) ? parsed.recentIssues : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      feedbackSummary: parsed.feedbackSummary || { averageRating: 0, total: 0 },
    };
  } catch {
    return null;
  }
}

function writeCachedDashboard(
  key: string,
  payload: {
    stats: Stats;
    recentIssues: AdminIssue[];
    notifications: DashboardDataResponse["notifications"];
    feedbackSummary: FeedbackSummary;
  }
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        stats: payload.stats,
        recentIssues: payload.recentIssues,
        notifications: payload.notifications,
        feedbackSummary: payload.feedbackSummary,
      })
    );
  } catch {
    // ignore storage failures
  }
}

function getMeterTone(value: number, inverse = false) {
  if (inverse) {
    if (value >= 45) return "bg-rose-500";
    if (value >= 20) return "bg-amber-500";
    return "bg-emerald-500";
  }

  if (value >= 75) return "bg-emerald-500";
  if (value >= 45) return "bg-amber-500";
  return "bg-rose-500";
}