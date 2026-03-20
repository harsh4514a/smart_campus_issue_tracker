"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type IssueStatus = "Pending" | "In Progress" | "Resolved";
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
};

type DateRangeFilter = "All" | "7d" | "30d" | "90d";
type StatusSortDirection = "asc" | "desc";

const POLL_INTERVAL_MS = 10000;
const REFERENCE_TIMESTAMP = Date.now();

export default function AdminReportsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | IssueStatus | "Assigned">("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("All");
  const [statusSortDirection, setStatusSortDirection] = useState<StatusSortDirection>("asc");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const load = (silent = false) => {
    const auth = loadAuth();
    if (!auth) return;

    if (!silent) {
      setLoading(true);
    }

    authFetch("/api/admin/issues", { method: "GET" }, auth.token)
      .then((data) => {
        setIssues((data.issues || []) as Issue[]);
        setError(null);
      })
      .catch((err) => {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Failed to load reports");
        }
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const auth = loadAuth();
    if (!auth) return;

    const intervalId = window.setInterval(() => {
      load(true);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const summary = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((issue) => issue.status === "Pending").length;
    const inProgress = issues.filter((issue) => issue.status === "In Progress").length;
    const resolved = issues.filter((issue) => issue.status === "Resolved").length;
    const assigned = issues.filter((issue) => Boolean(issue.assignedStaff?._id)).length;
    const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { total, pending, inProgress, resolved, assigned, resolvedRate };
  }, [issues]);

  const statusDonutData = useMemo(() => {
    const pending = issues.filter((issue) => issue.status === "Pending" && !issue.assignedStaff?._id).length;
    const assigned = issues.filter((issue) => issue.status === "Pending" && !!issue.assignedStaff?._id).length;
    const inProgress = issues.filter((issue) => issue.status === "In Progress").length;
    const resolved = issues.filter((issue) => issue.status === "Resolved").length;
    const total = Math.max(issues.length, 1);

    return [
      {
        name: "Pending",
        value: pending,
        renderValue: pending === 0 ? 0.0001 : pending,
        color: "#F59E0B",
        percent: Math.round((pending / total) * 100),
      },
      {
        name: "Assigned",
        value: assigned,
        renderValue: assigned === 0 ? 0.0001 : assigned,
        color: "#2563EB",
        percent: Math.round((assigned / total) * 100),
      },
      {
        name: "In Progress",
        value: inProgress,
        renderValue: inProgress === 0 ? 0.0001 : inProgress,
        color: "#7C3AED",
        percent: Math.round((inProgress / total) * 100),
      },
      {
        name: "Resolved",
        value: resolved,
        renderValue: resolved === 0 ? 0.0001 : resolved,
        color: "#16A34A",
        percent: Math.round((resolved / total) * 100),
      },
    ];
  }, [issues]);

  const departmentChartData = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach((issue) => {
      const departmentName =
        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";
      map.set(departmentName, (map.get(departmentName) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [issues]);

  const categoryPieData = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach((issue) => {
      map.set(issue.category, (map.get(issue.category) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [issues]);

  const activityTrendData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; created: number; resolved: number }[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: monthDate.toLocaleDateString(undefined, { month: "short" }),
        created: 0,
        resolved: 0,
      });
    }

    const monthMap = new Map(months.map((month) => [month.key, month]));

    issues.forEach((issue) => {
      if (!issue.createdAt) return;
      const date = new Date(issue.createdAt);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const month = monthMap.get(key);
      if (!month) return;

      month.created += 1;
      if (issue.status === "Resolved") {
        month.resolved += 1;
      }
    });

    return months.map((month) => ({
      month: month.label,
      created: month.created,
      resolved: month.resolved,
    }));
  }, [issues]);

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
    const now = REFERENCE_TIMESTAMP;
    const dateRangeMs =
      dateRangeFilter === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : dateRangeFilter === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : dateRangeFilter === "90d"
            ? 90 * 24 * 60 * 60 * 1000
            : null;

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

      return statusMatch && departmentMatch && categoryMatch && dateMatch;
    });

    return filtered.sort((a, b) => {
      const aRank = getIssueStatusRank(a);
      const bRank = getIssueStatusRank(b);
      return statusSortDirection === "asc" ? aRank - bRank : bRank - aRank;
    });
  }, [issues, statusFilter, departmentFilter, categoryFilter, dateRangeFilter, statusSortDirection]);

  return (
    <AdminProtected>
      <AdminShell title="Reports" subtitle="Professional reporting dashboard for issue operations">
        <div className="space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
                <SummaryCard label="In Progress" value={statsNumber(summary.inProgress)} tone="purple" Icon={LoaderCircle} />
                <SummaryCard
                  label="Resolved"
                  value={statsNumber(summary.resolved)}
                  tone="green"
                  Icon={CheckCircle2}
                  trend={trendIndicators.resolved}
                />
                <SummaryCard label="Assigned" value={statsNumber(summary.assigned)} tone="indigo" Icon={UserCheck} />
                <SummaryCard label="Resolved Rate" value={`${summary.resolvedRate}%`} tone="green" Icon={Sparkles} />
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <ChartCard title="Issues Distribution">
                  <div className="relative h-72 w-full">
                    {summary.total === 0 ? (
                      <EmptyChartMessage message="No data available yet" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusDonutData}
                            dataKey="renderValue"
                            nameKey="name"
                            innerRadius={62}
                            outerRadius={92}
                            paddingAngle={3}
                            label={({ name, payload }) => (payload?.value > 0 ? `${name} ${payload.value}` : "")}
                            labelLine
                          >
                            {statusDonutData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} fillOpacity={entry.value === 0 ? 0.3 : 1} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(_, name, item) => [item?.payload?.value ?? 0, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    {summary.total > 0 && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-xs font-semibold text-slate-500">Total Issues</p>
                          <p className="text-3xl font-semibold text-slate-900">{summary.total}</p>
                          {summary.resolved === 0 && <p className="text-xs font-medium text-slate-500">(No resolved yet)</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </ChartCard>

                <ChartCard title="Issues by Department">
                  <div className={`${departmentChartData.length === 0 ? "h-40" : "h-72"} w-full`}>
                    {departmentChartData.length === 0 ? (
                      <EmptyChartMessage message="No department data available yet" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={departmentChartData}
                          layout="vertical"
                          margin={{ top: 8, right: 36, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="department" width={130} />
                          <Tooltip formatter={(value) => [value, "Issues"]} />
                          <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 4, 4]}>
                            <LabelList dataKey="count" position="right" fill="#334155" fontSize={12} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartCard>
              </div>

              <ChartCard title="Issue Activity Trend">
                <div className={`${activityTrendData.every((point) => point.created === 0 && point.resolved === 0) ? "h-40" : "h-80"} w-full`}>
                  {activityTrendData.every((point) => point.created === 0 && point.resolved === 0) ? (
                    <EmptyChartMessage message="No data available yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activityTrendData} margin={{ top: 10, right: 16, left: 2, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="created" name="Created Issues" stroke="#0D9488" strokeWidth={3} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="resolved" name="Resolved Issues" stroke="#16A34A" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {summary.resolved === 0 && <p className="text-xs font-medium text-slate-500">No issues resolved yet</p>}
              </ChartCard>

              <ChartCard title="Issues by Category">
                <div className={`${categoryPieData.length === 0 ? "h-40" : "w-full"} w-full`}>
                  {categoryPieData.length === 0 ? (
                    <EmptyChartMessage message="No category insights available yet" />
                  ) : (
                    <>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={categoryPieData} dataKey="value" nameKey="name" outerRadius={112}>
                              {categoryPieData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-600 sm:grid-cols-2">
                        {categoryPieData.map((entry) => (
                          <p key={entry.name} className="truncate">
                            <span className="font-medium text-slate-700">{entry.name}</span> – {entry.value}
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </ChartCard>

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
                    <FilterSelect
                      label="Status"
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as "All" | IssueStatus | "Assigned")}
                      options={[
                        { label: "All", value: "All" },
                        { label: "Pending", value: "Pending" },
                        { label: "Assigned", value: "Assigned" },
                        { label: "In Progress", value: "In Progress" },
                        { label: "Resolved", value: "Resolved" },
                      ]}
                    />
                    <FilterSelect
                      label="Department"
                      value={departmentFilter}
                      onChange={setDepartmentFilter}
                      options={[{ label: "All", value: "All" }, ...departmentOptions.map((name) => ({ label: name, value: name }))]}
                    />
                    <FilterSelect
                      label="Category"
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      options={[{ label: "All", value: "All" }, ...categoryOptions.map((name) => ({ label: name, value: name }))]}
                    />
                    <FilterSelect
                      label="Date Range"
                      value={dateRangeFilter}
                      onChange={(value) => setDateRangeFilter(value as DateRangeFilter)}
                      options={[
                        { label: "All", value: "All" },
                        { label: "Last 7 days", value: "7d" },
                        { label: "Last 30 days", value: "30d" },
                        { label: "Last 90 days", value: "90d" },
                      ]}
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setStatusFilter("All");
                        setDepartmentFilter("All");
                        setCategoryFilter("All");
                        setDateRangeFilter("All");
                        setStatusSortDirection("asc");
                      }}
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
                      <Th>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
                          onClick={() => setStatusSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                        >
                          Status
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-slate-800">
                            {statusSortDirection === "asc" ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                          </span>
                        </button>
                      </Th>
                      <Th>Reported By</Th>
                      <Th>Date</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTableIssues.map((issue) => {
                      const departmentName =
                        issue.serviceDepartment?.name || issue.academicDepartment?.name || issue.department?.name || "Unassigned";

                      return (
                        <tr key={issue._id} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <Td className="font-semibold text-slate-800">
                            <button
                              type="button"
                              onClick={() => setSelectedIssue(issue)}
                              className="text-left text-teal-700 hover:underline"
                            >
                              {issue.title}
                            </button>
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
                          No reports match current filters.
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

function SummaryCard({
  label,
  value,
  tone,
  Icon,
  trend,
}: {
  label: string;
  value: string;
  tone: "blue" | "orange" | "purple" | "green" | "indigo";
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: TrendMeta;
}) {
  const toneClass: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{value}</p>
      {trend && (
        <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trend.textClass}`}>
          {trend.direction === "up" ? <ArrowUp size={12} /> : trend.direction === "down" ? <ArrowDown size={12} /> : <ArrowRight size={12} />}
          {trend.label}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{message}</div>;
}

function FilterSelect({
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
}

function StatusBadge({ status, isAssigned }: { status: IssueStatus; isAssigned: boolean }) {
  if (status === "Resolved") {
    return <Badge label="Resolved" className="bg-green-100 text-green-700" />;
  }

  if (status === "In Progress") {
    return <Badge label="In Progress" className="bg-purple-100 text-purple-700" />;
  }

  if (isAssigned) {
    return <Badge label="Assigned" className="bg-blue-100 text-blue-700" />;
  }

  return <Badge label="Pending" className="bg-orange-100 text-orange-700" />;
}

function PriorityBadge({ priority }: { priority: IssuePriority | null }) {
  if (!priority) {
    return <Badge label="—" className="bg-slate-100 text-slate-600" />;
  }

  if (priority === "Low") {
    return <Badge label="Low" className="bg-slate-100 text-slate-700" />;
  }

  if (priority === "Medium") {
    return <Badge label="Medium" className="bg-yellow-100 text-yellow-700" />;
  }

  return <Badge label={priority} className="bg-rose-100 text-rose-700" />;
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

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

function IconActionButton({
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
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">{children}</th>;
}

function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 text-sm text-slate-600 ${className}`}>
      {children}
    </td>
  );
}

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

const CATEGORY_COLORS = [
  "#0D9488",
  "#F59E0B",
  "#7C3AED",
  "#2563EB",
  "#16A34A",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
];

type TrendMeta = {
  direction: "up" | "down" | "flat";
  label: string;
  textClass: string;
};

function getTrendMeta(current: number, previous: number): TrendMeta {
  if (current > previous) {
    return { direction: "up", label: "vs last month", textClass: "text-emerald-600" };
  }

  if (current < previous) {
    return { direction: "down", label: "vs last month", textClass: "text-rose-600" };
  }

  return { direction: "flat", label: "vs last month", textClass: "text-slate-500" };
}

function getIssueStatusRank(issue: Issue) {
  if (issue.status === "Pending" && !issue.assignedStaff?._id) return 1;
  if (issue.status === "Pending" && issue.assignedStaff?._id) return 2;
  if (issue.status === "In Progress") return 3;
  return 4;
}
