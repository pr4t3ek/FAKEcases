"use client";

import Link from "next/link";
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
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { User } from "@prisma/client";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/dashboard/charts";
import { cn, toIndianWords } from "@/lib/utils";
import { formatValue, DeltaLabel } from "./sim-dashboard";
import { inScale, moneyScaleFor } from "./money";
import { MetricMap } from "./metric-map";
import { PrimerRecap } from "./concept-primer";
import { GlossaryProvider } from "./glossary-term";
import { SimCoachPanel } from "./sim-coach-panel";
import { ReplayButton } from "./replay-button";
import { QuestionBoard } from "@/components/leaderboard/question-board";
import type { SimulationReportData } from "./types";
import type { SimUnit } from "@/lib/sim/types";

function scoreTone(value: number): string {
  if (value >= 80) return "bg-success";
  if (value >= 55) return "bg-warning";
  return "bg-destructive";
}

export function SimulationReport({
  data,
  user,
}: {
  data: SimulationReportData;
  user: User | null;
}) {
  // Derived from the same budget the allocation screen used, so the debrief
  // cannot silently re-denominate the numbers the student just typed.
  const scale = moneyScaleFor(data.budgetRupees);

  return (
    // The debrief is where the vocabulary finally has to stick, so the same
    // hover definitions cover the outcome table and the metric map here too.
    <GlossaryProvider teaching={data.teaching}>
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="container max-w-5xl space-y-6 py-8">
        {/* ── Outcome first ───────────────────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {data.company}
              </div>
              <h1 className="mt-1 text-xl font-bold">What happened next</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Two {data.periodNoun}s on from your decision, against doing nothing and against the
                best use of the same budget.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">{data.overall}</div>
              <Badge variant={data.overall >= 70 ? "success" : data.overall >= 50 ? "warning" : "muted"}>
                {data.band}
              </Badge>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-medium">{data.northStarLabel}</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.northStarPaths} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="quarter" tick={CHART_TICK} />
                <YAxis tick={CHART_TICK} domain={["auto", "auto"]} tickFormatter={toIndianWords} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number) => toIndianWords(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  name="Best possible"
                  type="monotone"
                  dataKey="best"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  name="Do nothing"
                  type="monotone"
                  dataKey="doNothing"
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="2 4"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  name="What you did"
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── Every metric that moved ─────────────────────────────────────── */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold">Where the business ended up</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The headline number is never the whole story — this is what your decision did to
            everything else.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.outcome.map((row) => (
              <div key={row.driver} className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{row.label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {formatValue(row.actual, row.unit as SimUnit)}
                </div>
                <DeltaLabel deltaPct={row.changePct} goodDirection={row.goodDirection} />
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  doing nothing: {formatValue(row.doNothing, row.unit as SimUnit)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Where the decision landed in the chain ──────────────────────── */}
        {data.metricMap && (
          <MetricMap
            nodes={data.metricMap}
            title="The same chain, after your decision"
          />
        )}

        {/* ── Scorecard ───────────────────────────────────────────────────── */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold">How you played it</h2>
          <div className="mt-4 space-y-3">
            {data.scores.map((s) => (
              <div key={s.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="tabular-nums">{s.value}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn("h-full rounded-full", scoreTone(s.value))}
                    initial={{ width: 0 }}
                    animate={{ width: `${s.value}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>
              </div>
            ))}
          </div>

          {/* The separation is the whole architecture; saying so beats letting
              somebody assume a war-room score is an interview claim. */}
          <p className="mt-5 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            Simulations build a separate track. This score does not affect your interview readiness
            or your percentile rank — it is a different exercise with a different rubric.
          </p>

          {data.feedback.length > 0 && (
            <ul className="mt-4 space-y-2">
              {data.feedback.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  {f.tone === "positive" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : f.tone === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">{f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── The truth ───────────────────────────────────────────────────── */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold">What was actually happening</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">You named:</span>
            {data.yourDiagnosis.map((label) => (
              <Badge key={label} variant={data.causeFound ? "success" : "destructive"}>
                {label}
              </Badge>
            ))}
            {!data.causeFound && (
              <>
                <span className="text-muted-foreground">· it was:</span>
                {data.trueCauses.map((label) => (
                  <Badge key={label} variant="success">
                    {label}
                  </Badge>
                ))}
              </>
            )}
          </div>

          <ol className="mt-4 space-y-2">
            {data.causalChain.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-lg border-l-2 border-primary bg-primary/5 p-3">
            <div className="text-xs font-medium">Where the leverage was</div>
            <p className="mt-1 text-sm text-muted-foreground">{data.whereTheLeverageWas}</p>
          </div>
        </Card>

        {/* ── Allocation vs best ──────────────────────────────────────────── */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold">Your quarter against the best use of it</h2>
          <div className="mt-4 space-y-3">
            {data.allocation.map((row) => (
              <div
                key={row.interventionId}
                className={cn(
                  "rounded-lg border p-3",
                  row.onTarget ? "border-success/40 bg-success/5" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {row.onTarget ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.stalled && <Badge variant="destructive">Never shipped</Badge>}
                  </div>
                  <div className="flex gap-4 text-xs tabular-nums text-muted-foreground">
                    <span>
                      you:{" "}
                      {row.yours
                        ? `${row.yours.sprints} sp · ${inScale(row.yours.rupees, scale)}`
                        : "—"}
                    </span>
                    <span>
                      best:{" "}
                      {row.best ? `${row.best.sprints} sp · ${inScale(row.best.rupees, scale)}` : "—"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{row.note}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Investigation trail ─────────────────────────────────────────── */}
        {/* Hidden entirely on a format without an investigation phase. A
            turnaround spends no analyst-days, and reporting its period count
            under that noun is simply false. */}
        {/* The gap between what happened and what the decision was worth.
            Without it a run that landed 3% above its own expectation reads as
            a model that cannot add up — and the grade, which is on the
            expectation, reads as unfair. Naming the weather is what makes both
            honest. */}
        {data.variance && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Luck, separated out</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">What the quarter did</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  {formatValue(data.variance.realised, "inr")}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  What your decision was worth
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  {formatValue(data.variance.expected, "inr")}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {describeVariance(data.variance)} You are graded on the second number, not the
              first — the same decision played twice lands on two different quarters, and only
              one of those is something you did.
            </p>
          </Card>
        )}

        {/* Only shown to someone who actually changed their mind, and shown
            without a score attached. Updating a belief on evidence is a skill
            and it is invisible unless something writes it down — but grading it
            would turn "was I right to move?" into a mark, and the point is to
            let a candidate read their own reasoning back. */}
        {data.hypothesisTrail.length > 1 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold">How your thinking moved</h2>
            <ol className="mt-3 space-y-2">
              {data.hypothesisTrail.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {step.causes.join(" and ") || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {step.afterPurchases === 0
                        ? "Before buying anything"
                        : `After ${step.afterPurchases} pull${step.afterPurchases === 1 ? "" : "s"}`}
                      {step.note ? ` — “${step.note}”` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {data.hasInvestigation && (
        <Card className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">How you investigated</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.daysSpent} analyst-days spent · par is {data.daysPar}
            </span>
          </div>

          {data.trail.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              You committed without buying any data.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {data.trail.map((step) => (
                <li key={step.drilldownId} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                      step.onTrail ? "bg-success/20 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.seq}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {step.label}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({step.cost}d)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{step.readsAs}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {data.missed.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="text-xs font-medium text-muted-foreground">
                What you didn&apos;t look at, that would have shown you
              </div>
              <ul className="mt-2 space-y-1.5">
                {data.missed.map((m) => (
                  <li key={m.drilldownId} className="text-xs">
                    <span className="font-medium">{m.label}</span>{" "}
                    <span className="text-muted-foreground">({m.cost}d) — {m.readsAs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        )}

        {/* ── The model answer ────────────────────────────────────────────── */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold">What a strong answer sounds like</h2>
          {/* A list rather than a paragraph, and the structure is half the
              lesson: an interview answer has moves, and seeing them separated
              is how a candidate learns to make them. */}
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {data.strongAnswer.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground/60">
                  •
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {data.teaching && (
            <div className="mt-4 border-t pt-3">
              <div className="mb-2 text-xs text-muted-foreground">
                Terms this simulation used — hover any of them for the definition.
              </div>
              <PrimerRecap teaching={data.teaching} />
            </div>
          )}
        </Card>

        {/* ── How this run stands against everyone else's first go ────────── */}
        <QuestionBoard
          rows={data.leaderboard}
          kind="simulation"
          userId={user?.id}
          standing={data.standing}
          thisScore={data.overall}
        />

        <SimCoachPanel runId={data.runId} available={data.coachAvailable} />

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/simulations">
              Another war room <ArrowRight />
            </Link>
          </Button>
          {/* The same scenario again, with the ranking bargain stated up front.
              `isThisAttempt` is false when the run being read is itself a replay,
              which only changes the wording — see ReplayButton. */}
          <ReplayButton
            questionId={data.questionId}
            label="Play this again"
            variant="secondary"
            alreadyReplay={data.standing != null && !data.standing.isThisAttempt}
          />
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        {data.isGuest && (
          <Card className="border-primary/30 bg-primary/5 p-4 text-sm">
            You&apos;re playing as a guest.{" "}
            <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
              Create a free account
            </Link>{" "}
            to keep this run and your progress.
          </Card>
        )}
      </main>
    </div>
    </GlossaryProvider>
  );
}

/**
 * How far the quarter ran from the decision, in words.
 *
 * Deliberately never congratulatory about the gap in either direction: good
 * luck is not an achievement and bad luck is not a lesson, and the whole point
 * of separating them is to stop a student reading either as feedback.
 */
function describeVariance({ realised, expected }: { realised: number; expected: number }): string {
  if (expected === 0) return "The quarter and the decision landed in the same place.";
  const gap = (realised - expected) / Math.abs(expected);
  const pct = Math.abs(gap * 100);

  if (pct < 0.5) return "The quarter landed almost exactly where the decision put it.";
  if (gap > 0) {
    return `The quarter ran about ${pct.toFixed(1)}% ahead of that — conversion and returns went your way, which is weather rather than a decision.`;
  }
  return `The quarter ran about ${pct.toFixed(1)}% behind it — conversion and returns went against you, which is weather rather than a mistake.`;
}
