"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { rankMeta, type Rank } from "@/lib/config";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/dashboard/charts";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** "2026-08-01" → "1 Aug", so a 30-point axis stays readable. */
function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

export function SignupsChart({ data }: { data: { day: string; count: number }[] }) {
  if (data.every((d) => d.count === 0)) {
    return <Empty>No signups in the last 30 days.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          tickFormatter={shortDay}
          // 30 daily labels won't fit; show roughly one a week.
          interval={6}
          tick={CHART_TICK}
        />
        <YAxis allowDecimals={false} tick={CHART_TICK} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={shortDay} />
        <Line
          type="monotone"
          dataKey="count"
          name="Signups"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={{ r: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RankDistributionChart({ data }: { data: { rank: string; count: number }[] }) {
  if (data.every((d) => d.count === 0)) {
    return <Empty>Nobody is ranked yet — it takes five graded attempts.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="rank" tick={CHART_TICK} />
        <YAxis allowDecimals={false} tick={CHART_TICK} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="count" name="Users" radius={[4, 4, 0, 0]}>
          {/* The ladder already has colours; reusing them keeps the chart and
              the rank badges elsewhere in the app saying the same thing. */}
          {data.map((d) => (
            <Cell key={d.rank} fill={rankMeta[d.rank as Rank]?.color ?? "hsl(var(--primary))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
