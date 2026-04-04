"use client";

import { memo, useMemo, useState } from "react";
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
  date: string;
  created: number;
  resolved: number;
};

type DateRangeKey = "7d" | "30d";

type ChartRow = {
  dateKey: string;
  shortDate: string;
  fullDate: string;
  created: number;
  resolved: number;
  backlog: number;
};

const COLOR_CREATED = "#2563EB";
const COLOR_RESOLVED = "#16A34A";
const COLOR_BACKLOG = "#DC2626";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string) {
  const parsed = new Date(`${key}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatTrendDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return {
        label: "0% issues compared to last week",
        toneClass: "text-slate-600",
      };
    }

    return {
      label: "+100% issues compared to last week",
      toneClass: "text-emerald-700",
    };
  }

  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta);
  const sign = rounded > 0 ? "+" : "";

  if (rounded === 0) {
    return {
      label: "0% issues compared to last week",
      toneClass: "text-slate-600",
    };
  }

  return {
    label: `${sign}${rounded}% issues compared to last week`,
    toneClass: rounded > 0 ? "text-emerald-700" : "text-rose-700",
  };
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-44 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-slate-700">{row.fullDate}</p>
      <div className="mt-2 space-y-1 text-xs">
        <p className="flex items-center justify-between gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_CREATED }} />Created Issues</span>
          <strong className="text-slate-900">{row.created}</strong>
        </p>
        <p className="flex items-center justify-between gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_RESOLVED }} />Resolved Issues</span>
          <strong className="text-slate-900">{row.resolved}</strong>
        </p>
        <p className="flex items-center justify-between gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_BACKLOG }} />Backlog</span>
          <strong className="text-slate-900">{row.backlog}</strong>
        </p>
      </div>
    </div>
  );
}

function buildRangeSeries(dataMap: Map<string, { created: number; resolved: number }>, days: number) {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const shortFormatter = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  });

  const fullFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let cumulativeBacklog = 0;
  const rows: ChartRow[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(endDate);
    current.setDate(endDate.getDate() - offset);
    const key = toDateKey(current);
    const source = dataMap.get(key);
    const created = Number(source?.created || 0);
    const resolved = Number(source?.resolved || 0);

    cumulativeBacklog = Math.max(0, cumulativeBacklog + (created - resolved));

    rows.push({
      dateKey: key,
      shortDate: shortFormatter.format(current),
      fullDate: fullFormatter.format(current),
      created,
      resolved,
      backlog: cumulativeBacklog,
    });
  }

  return rows;
}

function sumCreatedForPreviousPeriod(dataMap: Map<string, { created: number; resolved: number }>, days: number) {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  let total = 0;
  for (let offset = days * 2 - 1; offset >= days; offset -= 1) {
    const current = new Date(endDate);
    current.setDate(endDate.getDate() - offset);
    const key = toDateKey(current);
    total += Number(dataMap.get(key)?.created || 0);
  }

  return total;
}

function IssueTrendChart({ data }: { data: TrendPoint[] }) {
  const [range, setRange] = useState<DateRangeKey>("7d");

  const dataMap = useMemo(() => {
    const nextMap = new Map<string, { created: number; resolved: number }>();

    data.forEach((row) => {
      const rawKey = String(row.date || "").slice(0, 10);
      const parsedDate = parseDateKey(rawKey);
      if (!parsedDate) return;

      const key = toDateKey(parsedDate);
      const prev = nextMap.get(key) || { created: 0, resolved: 0 };

      nextMap.set(key, {
        created: prev.created + Number(row.created || 0),
        resolved: prev.resolved + Number(row.resolved || 0),
      });
    });

    return nextMap;
  }, [data]);

  const visibleDays = range === "30d" ? 30 : 7;

  const chartRows = useMemo(
    () => buildRangeSeries(dataMap, visibleDays),
    [dataMap, visibleDays]
  );

  const chartStats = useMemo(() => {
    const currentCreated = chartRows.reduce((sum, row) => sum + row.created, 0);
    const previousCreated = sumCreatedForPreviousPeriod(dataMap, visibleDays);
    const latestBacklog = chartRows.length > 0 ? chartRows[chartRows.length - 1].backlog : 0;
    const trendDelta = formatTrendDelta(currentCreated, previousCreated);

    return {
      currentCreated,
      previousCreated,
      latestBacklog,
      trendLabel: trendDelta.label,
      trendToneClass: trendDelta.toneClass,
    };
  }, [chartRows, dataMap, visibleDays]);

  const barSize = range === "30d" ? 8 : 16;

  return (
    <div className="h-full min-h-0 rounded-lg border border-slate-100 bg-slate-50/30 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${chartStats.trendToneClass}`}>{chartStats.trendLabel}</p>
          <p className="mt-1 text-xs text-slate-500">
            {chartStats.currentCreated} created vs {chartStats.previousCreated} previous period • Backlog: {chartStats.latestBacklog}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setRange("7d")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              range === "7d" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setRange("30d")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              range === "30d" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Last 30 days
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-68px)] min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="shortDate"
              tick={{ fontSize: 11, fill: "#64748B" }}
              tickLine={false}
              axisLine={false}
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748B" }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "#EEF2FF" }}
              content={<TrendTooltip />}
            />
            <Legend
              iconType="circle"
              verticalAlign="top"
              height={28}
              wrapperStyle={{ fontSize: 12, color: "#475569" }}
            />
            <Bar
              dataKey="created"
              name="Created Issues"
              fill={COLOR_CREATED}
              radius={[6, 6, 0, 0]}
              barSize={barSize}
            />
            <Bar
              dataKey="resolved"
              name="Resolved Issues"
              fill={COLOR_RESOLVED}
              radius={[6, 6, 0, 0]}
              barSize={barSize}
            />
            <Line
              type="monotone"
              dataKey="backlog"
              name="Backlog"
              stroke={COLOR_BACKLOG}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: COLOR_BACKLOG }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(IssueTrendChart);
