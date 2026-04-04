"use client";

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

type TrendPoint = {
  date: string;
  created: number;
  resolved: number;
};

type PriorityRow = {
  priority: string;
  count: number;
  percentage: number;
};

type DeptAdminReportsChartsProps = {
  trend: TrendPoint[];
  priorityDistribution: PriorityRow[];
};

export default function DeptAdminReportsCharts({
  trend,
  priorityDistribution,
}: DeptAdminReportsChartsProps) {
  return (
    <>
      <IssueTrendChart data={trend} />
      <PriorityDistributionCard rows={priorityDistribution} />
    </>
  );
}

function IssueTrendChart({ data }: { data: TrendPoint[] }) {
  const hasRenderableData = data.some((row) => row.created > 0 || row.resolved > 0);
  const chartData = data.map((row) => ({
    ...row,
    dateTs: new Date(row.date).getTime(),
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700">Issue Trend</h3>
      <div className="mt-3 h-75">
        {!hasRenderableData ? (
          <div className="h-full rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-medium text-slate-600">No data available for the selected period.</p>
            <div className="mt-4 flex items-end gap-2">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="h-14 w-6 rounded-t bg-slate-200/70" />
              ))}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="dateTs"
                type="number"
                domain={["dataMin", "dataMax"]}
                padding={{ left: 20, right: 20 }}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(Number(value));
                  if (Number.isNaN(date.getTime())) return "";
                  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0")}`;
                }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" name="Created" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function PriorityDistributionCard({ rows }: { rows: PriorityRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const hasRenderableData = rows.some((row) => row.count > 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700">Priority Distribution</h3>
      <div className="mt-4 space-y-2">
        {!hasRenderableData ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">No data available for selected filters.</p>
            {rows.map((row) => (
              <div key={row.priority}>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>{row.priority}</span>
                  <span>0 (0%)</span>
                </div>
                <div className="h-2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          rows.map((row) => (
            <button
              key={row.priority}
              type="button"
              title={`${row.priority}: ${row.count}`}
              className="w-full rounded p-0.5 text-left hover:bg-slate-50"
            >
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{row.priority}</span>
                <span>
                  {row.count} ({row.percentage}%)
                </span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className={`h-2 rounded ${priorityTone(row.priority)}`}
                  style={{ width: `${Math.max(5, (row.count / max) * 100)}%` }}
                />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function priorityTone(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized === "urgent") return "bg-rose-500";
  if (normalized === "high") return "bg-orange-500";
  if (normalized === "medium") return "bg-amber-500";
  if (normalized === "low") return "bg-emerald-500";
  return "bg-slate-400";
}
