"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Target } from "lucide-react";
import {
  classDaysPar,
  classStandings,
  costScorePoints,
  type Roster,
} from "@/lib/rooms/roster";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/dashboard/charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** Matches the medal treatment on the practice board rather than inventing a second one. */
const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * How the class did.
 *
 * Takes the roster the console is already polling, so this whole tab is live
 * without a single additional request. Every number here is derived in
 * `lib/rooms/roster.ts`, which is pure and tested — this file only draws.
 */
export function ClassStandings({ roster }: { roster: Roster }) {
  const { standings, points, par } = useMemo(
    () => ({
      standings: classStandings(roster.rows),
      points: costScorePoints(roster.rows),
      par: classDaysPar(roster.rows),
    }),
    [roster],
  );

  if (!standings.length) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No finished runs yet. Scores appear here as students commit their decisions.
      </Card>
    );
  }

  // Split rather than tinted per-point: recharts colours a <Scatter> as a
  // series, and two series is also what gives the chart a legend for free.
  const found = points.filter((p) => p.causeFound);
  const missed = points.filter((p) => !p.causeFound);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Cost against score</h3>
          <p className="text-xs text-muted-foreground">
            Cheap and correct is up and to the left.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="daysSpent"
              name="Analyst-days"
              tick={CHART_TICK}
              // From zero so the spend axis is not silently truncated — a chart
              // that starts at 4 makes 5 days look like nothing.
              domain={[0, "dataMax + 1"]}
              allowDecimals={false}
            />
            <YAxis
              type="number"
              dataKey="overall"
              name="Score"
              domain={[0, 100]}
              tick={CHART_TICK}
            />
            <ZAxis range={[90, 90]} />
            {par !== null && (
              <ReferenceLine
                x={par}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{ value: `par ${par}`, position: "top", fontSize: 11 }}
              />
            )}
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: number, name: string) => [value, name]}
              labelFormatter={() => ""}
            />
            <Scatter name="Found the cause" data={found} fill="hsl(var(--primary))" />
            <Scatter
              name="Missed it"
              data={missed}
              fill="hsl(var(--muted-foreground))"
              fillOpacity={0.55}
            />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Found the cause
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" /> Missed it
          </span>
          {par !== null && (
            <span className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> {roster.summary.underPar} of {standings.length}{" "}
              came in at or under par
            </span>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 w-12">#</th>
              <th className="p-3">Student</th>
              <th className="p-3 text-right">Score</th>
              <th className="p-3">Band</th>
              <th className="p-3 text-right">Analyst-days</th>
              <th className="p-3">Cause</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {standings.map((row) => (
              <tr key={row.userId} className="hover:bg-accent/40">
                <td className="p-3 tabular-nums text-muted-foreground">
                  {row.rank <= 3 ? MEDAL[row.rank - 1] : row.rank}
                </td>
                <td className="p-3 font-medium">{row.displayName}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{row.overall}</td>
                <td className="p-3">
                  <Badge variant="outline">{row.band}</Badge>
                </td>
                <td className="p-3 text-right tabular-nums">
                  {row.daysSpent}
                  {par !== null && row.daysSpent !== null && row.daysSpent <= par && (
                    <span className="ml-1.5 text-xs font-normal text-success">under</span>
                  )}
                </td>
                <td className="p-3">
                  {row.causeFound ? (
                    <Badge variant="success">Found</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Missed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
