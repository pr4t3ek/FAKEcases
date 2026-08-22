"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Target } from "lucide-react";
import {
  bandSpread,
  causeMix,
  dimensionAverages,
  medianRunTime,
  phaseFunnel,
  spendAgainstPar,
  type Roster,
} from "@/lib/rooms/roster";
import { simBands } from "@/lib/config/simulation";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/dashboard/charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * How the class is doing, as opposed to how one student is.
 *
 * The third view on the console, and it answers the questions the roster and the
 * standings cannot: where the room is standing *right now*, what it was
 * collectively good and bad at, and which wrong answer attracted it. A professor
 * with forty students cannot get any of that by reading badges down a table.
 *
 * Fed by the roster the console already polls — every number here is derived in
 * `lib/rooms/roster.ts`, which is pure and tested, so this file only draws and
 * the whole view is live without a single extra request. The same argument
 * `class-standings.tsx` makes, for the same reason.
 *
 * The cause labels come from the page rather than from here: this component is
 * rendered inside a client-side poller, and the scenario lives in `lib/sim/`.
 */
export function ClassAnalytics({
  roster,
  causes,
  trueCauseIds,
  scenarioKnown,
}: {
  roster: Roster;
  /** Every cause on this scenario's board, id and label. */
  causes: { id: string; label: string }[];
  /** The ones the scenario declares as actually driving the metric. */
  trueCauseIds: string[];
  /** False when the run outlived its scenario — see `getScenario`. */
  scenarioKnown: boolean;
}) {
  const { phases, dimensions, bands, spend, blamed, median } = useMemo(
    () => ({
      phases: phaseFunnel(roster.rows),
      dimensions: dimensionAverages(roster.rows),
      bands: bandSpread(roster.rows, simBands.map((b) => b.band)),
      spend: spendAgainstPar(roster.rows),
      blamed: causeMix(roster.rows, causes, trueCauseIds),
      median: medianRunTime(roster.rows),
    }),
    [roster, causes, trueCauseIds],
  );

  const finished = roster.summary.finished;
  const inRoom = roster.rows.length;

  if (inRoom === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nothing to read yet — the class analytics fill in as students join and play.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Where the room is standing ──────────────────────────────────── */}
      <Card className="p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Where the class is</h3>
          <p className="text-xs text-muted-foreground">
            Live. {inRoom} in the room{median !== null && ` · median run ${formatMinutes(median)}`}
          </p>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The phase each student is standing on. A pile-up on one of them is the moment to stop
          and explain it rather than to keep going.
        </p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={phases} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={CHART_TICK} />
            <YAxis allowDecimals={false} tick={CHART_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
              {phases.map((p) => (
                <Cell
                  key={p.key}
                  // Not started is the one a professor acts on first, and it is
                  // the only bar that means something is wrong.
                  fill={p.key === "joined" ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {finished === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nobody has committed a decision yet. Scores, the class&apos;s strengths and what it
          blamed all appear here as runs finish.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ── What they were good and bad at ─────────────────────────── */}
            <Card className="p-5">
              <h3 className="font-semibold">What the class was good at</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                The five scored dimensions, averaged over {finished} finished run
                {finished === 1 ? "" : "s"}. An average of {roster.summary.averageScore} is not
                something to teach from; a low Decision against a high Diagnosis is.
              </p>
              {dimensions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  These runs carry no per-dimension scores.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={230}>
                    <RadarChart data={dimensions} outerRadius="72%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="label" tick={CHART_TICK} />
                      <PolarRadiusAxis domain={[0, 100]} tick={CHART_TICK} angle={90} />
                      <Radar
                        name="Class average"
                        dataKey="average"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.35}
                      />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dimensions.map((d) => (
                      <Badge
                        key={d.key}
                        variant={d.average >= 70 ? "success" : d.average >= 50 ? "secondary" : "warning"}
                      >
                        {d.label} {d.average}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* ── What they blamed ───────────────────────────────────────── */}
            <Card className="p-5">
              <h3 className="font-semibold">What they blamed</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Causes named at Decide, across the class. A decoy that pulled in half the room is
                worth ten minutes of the next lecture. Students may name more than one, so these
                add up to more than {finished}.
              </p>
              {!scenarioKnown ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  This room&apos;s scenario is no longer in the catalogue, so its causes cannot be
                  named.
                </p>
              ) : blamed.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing has been named yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, blamed.length * 34)}>
                  <BarChart
                    data={blamed}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis type="number" allowDecimals={false} tick={CHART_TICK} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ ...CHART_TICK, width: 145 }}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="count" name="Named by" radius={[0, 4, 4, 0]}>
                      {/* Green is the cause that was actually there. Everything
                          else on this chart is a room's worth of wrong answers,
                          which is the interesting half. */}
                      {blamed.map((cause) => (
                        <Cell
                          key={cause.id}
                          fill={
                            cause.correct
                              ? "hsl(var(--success))"
                              : "hsl(var(--muted-foreground))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-success align-middle" />
                the cause that was actually there · {roster.summary.causesFound} of {finished}{" "}
                found it
              </p>
            </Card>
          </div>

          {/* ── How they scored, and what it cost them ──────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold">How the scores fell</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                The shape behind the average — two clusters and a mean of 60 is a different class
                from everyone landing on 60.
              </p>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={bands} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={CHART_TICK} />
                  <YAxis allowDecimals={false} tick={CHART_TICK} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar
                    dataKey="count"
                    name="Students"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold">What it cost them</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Analyst-days against the budget the scenario authored. Buying past par is the habit
                this format exists to price, and it is the one a class does together.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Spend label="Under par" value={spend.under} tone="good" />
                <Spend label="At par" value={spend.at} />
                <Spend label="Over par" value={spend.over} tone={spend.over > 0 ? "bad" : undefined} />
              </div>
              <p className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                {spend.averageDays !== null && (
                  <span className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" /> {spend.averageDays} analyst-days on average
                  </span>
                )}
                {median !== null && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {formatMinutes(median)} median in the room
                  </span>
                )}
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Spend({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-warning",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

/** "18 min", or "1h 04m" once a room has been at it that long. */
function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
