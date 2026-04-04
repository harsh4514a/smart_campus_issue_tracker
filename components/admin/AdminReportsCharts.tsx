"use client";

import { memo, type ReactNode } from "react";
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

type StatusFilterValue = "Pending" | "In Progress" | "Resolved" | "Rejected";

type StatusDonutRow = {
  name: string;
  value: number;
  renderValue: number;
  color: string;
};

type DepartmentChartRow = {
  department: string;
  count: number;
};

type ActivityTrendRow = {
  date: string;
  dateTs: number;
  created: number;
  resolved: number;
};

type DashboardInsights = {
  pendingPercent: number;
  topDepartmentText: string;
};

type AdminReportsChartsProps = {
  summaryTotal: number;
  summaryResolved: number;
  statusDonutData: StatusDonutRow[];
  departmentChartData: DepartmentChartRow[];
  activityTrendData: ActivityTrendRow[];
  dashboardInsights: DashboardInsights;
  onStatusSelect: (status: StatusFilterValue) => void;
  onDepartmentSelect: (department: string) => void;
  onDateSelect: (date: string) => void;
};

const AdminReportsCharts = memo(function AdminReportsCharts({
  summaryTotal,
  summaryResolved,
  statusDonutData,
  departmentChartData,
  activityTrendData,
  dashboardInsights,
  onStatusSelect,
  onDepartmentSelect,
  onDateSelect,
}: AdminReportsChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartCard title="Issues by Status" className="h-full">
        <div className="relative h-72 w-full">
          {summaryTotal === 0 ? (
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
                  onClick={(entry) => {
                    if (!entry || typeof entry !== "object") return;
                    const label = String((entry as { name?: string }).name || "");
                    if (
                      label === "Pending" ||
                      label === "In Progress" ||
                      label === "Resolved" ||
                      label === "Rejected"
                    ) {
                      onStatusSelect(label as StatusFilterValue);
                    }
                  }}
                  label={({ name, payload }) =>
                    payload?.value > 0 ? `${name} ${payload.value}` : ""
                  }
                  labelLine
                >
                  {statusDonutData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      fillOpacity={entry.value === 0 ? 0.3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(_, name, item) => [item?.payload?.value ?? 0, name]} />
                <Legend verticalAlign="bottom" height={24} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {summaryTotal > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-500">Total Issues</p>
                <p className="text-3xl font-semibold text-slate-900">{summaryTotal}</p>
                {summaryResolved === 0 && (
                  <p className="text-xs font-medium text-slate-500">(No resolved yet)</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-600">
          {statusDonutData.map((entry) => (
            <p key={entry.name}>
              <span style={{ color: entry.color }}>●</span> {entry.name} - {entry.value}
            </p>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Issues by Department" className="h-full">
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
                <Bar
                  dataKey="count"
                  fill="#0D9488"
                  radius={[4, 4, 4, 4]}
                  onClick={(entry) => {
                    const department = String(
                      (entry as { department?: string })?.department || ""
                    );
                    if (department) {
                      onDepartmentSelect(department);
                    }
                  }}
                >
                  <LabelList dataKey="count" position="right" fill="#334155" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      <ChartCard title="Issue Activity Trend" className="h-full">
        <div
          className={`${
            activityTrendData.every(
              (point) => point.created === 0 && point.resolved === 0
            )
              ? "h-40"
              : "h-72"
          } w-full`}
        >
          {activityTrendData.every(
            (point) => point.created === 0 && point.resolved === 0
          ) ? (
            <EmptyChartMessage message="No data available yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={activityTrendData}
                margin={{ top: 10, right: 16, left: 2, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="dateTs"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  padding={{ left: 20, right: 20 }}
                  tickFormatter={(value) => {
                    const date = new Date(Number(value));
                    if (Number.isNaN(date.getTime())) return "";
                    return `${date.getDate().toString().padStart(2, "0")}/${(
                      date.getMonth() + 1
                    )
                      .toString()
                      .padStart(2, "0")}`;
                  }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created Issues"
                  stroke="#0D9488"
                  strokeWidth={3}
                  dot={(props) => {
                    const isLatest = props.index === activityTrendData.length - 1;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isLatest ? 7 : 4}
                        fill={isLatest ? "#0F766E" : "#0D9488"}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{
                    r: 6,
                    onClick: (event) => {
                      const payload = (event as { payload?: { date?: string } })?.payload;
                      if (!payload?.date) return;
                      onDateSelect(payload.date);
                    },
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved Issues"
                  stroke="#16A34A"
                  strokeWidth={3}
                  dot={(props) => {
                    const isLatest = props.index === activityTrendData.length - 1;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isLatest ? 7 : 4}
                        fill={isLatest ? "#15803D" : "#16A34A"}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {activityTrendData.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />Created Issues
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-green-600" />Resolved Issues
            </span>
            <span className="text-slate-500">Tip: click a point to filter the report date.</span>
          </div>
        ) : null}
        {summaryResolved === 0 && (
          <p className="text-xs font-medium text-slate-500">No issues resolved yet</p>
        )}
      </ChartCard>

      <ChartCard title="Insights" className="h-full">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-700">
              Most issues are pending (
              <span className="font-semibold">{dashboardInsights.pendingPercent}%</span>).
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-700">{dashboardInsights.topDepartmentText}.</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm font-medium text-emerald-800">
              Created vs Resolved trend helps track whether backlog is improving or growing.
            </p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
});

const ChartCard = memo(function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:scale-[1.01] hover:shadow-md ${className}`}
    >
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
});

const EmptyChartMessage = memo(function EmptyChartMessage({
  message,
}: {
  message: string;
}) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{message}</div>;
});

export default AdminReportsCharts;
