"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/dashboard/charts";
import type { ActiveWeek, Bucket, CoverageBucket, FormatRow } from "@/lib/admin-analytics";

/**
 * The Analytics tab's charts.
 *
 * Same posture as `user-charts.tsx`: the shaping is already done in
 * `lib/admin-analytics.ts` and tested there, so these components only draw. The
 * empty state is deliberate on every one of them — a fresh install has no
 * activity at all, and an axis with no line reads as broken rather than as new.
 */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** "2026-08-17" → "17 Aug". */
function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

export function FormatMixChart({ data }: { data: FormatRow[] }) {
  if (data.every((d) => d.started === 0)) {
    return <Empty>Nothing has been opened yet.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={CHART_TICK} />
        <YAxis type="category" dataKey="label" width={84} tick={CHART_TICK} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Started behind, finished in front, so the gap between them IS the
            abandonment — the number this chart exists to make visible. */}
        <Bar dataKey="started" name="Opened" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
        <Bar dataKey="submitted" name="Finished" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ActiveWeeksChart({ data }: { data: ActiveWeek[] }) {
  if (data.every((d) => d.activeUsers === 0)) {
    return <Empty>Nobody has practised in the last eight weeks.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="week" tickFormatter={shortDay} tick={CHART_TICK} />
        <YAxis yAxisId="left" allowDecimals={false} tick={CHART_TICK} />
        {/* Days in a week, fixed — a scale that rescaled itself would make one
            person's busy fortnight look like a trend. */}
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 7]}
          allowDecimals={false}
          tick={CHART_TICK}
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={shortDay} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          yAxisId="left"
          dataKey="activeUsers"
          name="People active"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgActiveDays"
          name="Days each"
          stroke="hsl(var(--warning))"
          strokeWidth={2.5}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function QuietChart({ data, modal }: { data: Bucket[]; modal: string | null }) {
  if (data.every((d) => d.count === 0)) {
    return <Empty>Nobody has gone quiet yet — which is either very good news or a very new install.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={CHART_TICK} />
        <YAxis allowDecimals={false} tick={CHART_TICK} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="count" name="Accounts" radius={[4, 4, 0, 0]}>
          {/* The mode is the reading — see the sentence under the chart — so it
              is the one bar that has to be findable at a glance. */}
          {data.map((d) => (
            <Cell
              key={d.label}
              fill={d.label === modal ? "hsl(var(--warning))" : "hsl(var(--primary))"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CoverageChart({ data }: { data: CoverageBucket[] }) {
  if (data.every((d) => d.pro === 0 && d.free === 0)) {
    return <Empty>No account has opened a question yet.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={CHART_TICK} />
        <YAxis allowDecimals={false} tick={CHART_TICK} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Stacked, because the question is how many people sit in a band —
            the tier split is what you look at second. */}
        <Bar dataKey="free" name="Free" stackId="a" fill="hsl(var(--muted-foreground))" />
        <Bar dataKey="pro" name="Pro" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
