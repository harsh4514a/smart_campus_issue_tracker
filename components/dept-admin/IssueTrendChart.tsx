"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = {
  issues: number;
  movingAvg: number;
  shortDate: string;
  fullDate: string;
};

export default function IssueTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No trend data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis
          dataKey="shortDate"
          tick={{ fontSize: 12, fill: "#64748B" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748B" }}
          tickLine={false}
          axisLine={false}
          width={34}
        />
        <Tooltip
          cursor={{ fill: "#F1F5F9" }}
          contentStyle={{ borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 12 }}
          labelFormatter={(label, payload) => {
            const point = payload?.[0]?.payload as { fullDate?: string } | undefined;
            return point?.fullDate || String(label);
          }}
          formatter={(value, name) => {
            if (name === "3-day Avg") return [Number(value).toFixed(1), name];
            return [value, name];
          }}
        />
        <Legend iconType="circle" verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "#475569" }} />
        <Bar
          dataKey="issues"
          name="Daily Issues"
          fill="#14B8A6"
          radius={[8, 8, 0, 0]}
          barSize={24}
        />
        <Line
          type="monotone"
          dataKey="movingAvg"
          name="3-day Avg"
          stroke="#0F172A"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#0F172A" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
