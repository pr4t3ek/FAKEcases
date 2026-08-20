"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bot, Trophy, User as UserIcon } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { startSolo } from "@/app/actions/arena";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatValue } from "@/components/simulation/format";
import type { ArenaDebriefData, DebriefSeat } from "@/lib/arena/payload";
import { money } from "./format";

/**
 * What the eight quarters did, and why.
 *
 * Two things are separated here on purpose, because conflating them is the
 * easiest way to make a debrief lie. **Placing** is who won the city, on
 * enterprise value. **Overall** is a report card on how the business was run.
 * They genuinely disagree — a firm can finish second with the tidier operation —
 * and a player who came second deserves to be told both rather than have one
 * quietly relabelled as the other.
 *
 * The rivals' objectives are released here and nowhere else. A debrief that only
 * gave you your own score would be a mark; the reason a run is worth reading is
 * finding out that the firm undercutting you all year was never trying to make
 * money.
 *
 * This is also the first real debrief any config-driven simulator in the app has
 * had — `app/simulate/[runId]/page.tsx` still sends a finished buyback run back
 * to the catalogue, and the shape here is what that one should borrow.
 */
export function ArenaDebrief({ data }: { data: ArenaDebriefData }) {
  const [pending, startTransition] = useTransition();
  const you = data.seats.find((s) => s.isYou) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{data.gameLabel} — debrief</h1>
          {you && (
            <Badge variant={you.placing === 1 ? "success" : "secondary"}>
              {ordinal(you.placing)} of {data.seats.length}
            </Badge>
          )}
        </div>
        {you && (
          <p className="text-muted-foreground">
            You finished {ordinal(you.placing)} on enterprise value with {money(you.npv)}, and
            scored <strong>{you.overall}</strong> on how the business was run — {you.band}.{" "}
            {you.placing === 1
              ? "You won the city."
              : "Placing is who won the city; the score is how well you ran the firm. They do not always agree."}
          </p>
        )}
      </header>

      <Standings seats={data.seats} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">A firm that never adjusted</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{money(data.reference.median)}</div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            The median of {""}
            {data.seats.length > 0 ? "many" : "no"} runs of this exact market by a firm that held its
            opening decisions for all {data.totalRounds} quarters. Beating it is most of what a good
            score is; {money(data.reference.p10)} to {money(data.reference.p90)} is the middle of
            what this market could pay.
          </p>
        </Card>

        <Card className="p-4 sm:col-span-2">
          <div className="mb-2 text-xs text-muted-foreground">The price war, quarter by quarter</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={toRows(data)}
                margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
              >
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => `₹${value}`}
                />
                {data.priceHistory.map((firm, i) => (
                  <Line
                    key={firm.seatIndex}
                    type="monotone"
                    dataKey={firm.name}
                    stroke={SERIES[i % SERIES.length]}
                    strokeWidth={firm.isYou ? 2.5 : 1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {you && <Rubric seat={you} />}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">What your rivals were playing for</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {data.seats
            .filter((s) => s.isAi && s.objective)
            .map((s) => (
              <Card key={s.seatIndex} className="p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {s.name}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.objective}</p>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  Finished {ordinal(s.placing)} · {money(s.npv)}
                </p>
              </Card>
            ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button disabled={pending} onClick={() => startTransition(async () => void (await startSolo()))}>
          Play again
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/arena">Back to the Arena</Link>
        </Button>
      </div>
    </div>
  );
}

function Standings({ seats }: { seats: DebriefSeat[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Firm</th>
              <th className="p-3 text-right font-medium" title="Discounted value of the eight quarters">
                Enterprise value
              </th>
              <th className="p-3 text-right font-medium" title="How the business was run, on the five-dimension rubric">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {seats.map((seat) => (
              <tr key={seat.seatIndex} className={cn(seat.isYou && "bg-accent/40")}>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {seat.placing === 1 && <Trophy className="h-4 w-4 text-amber-500" aria-hidden />}
                    {seat.isAi ? (
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    ) : (
                      <UserIcon className="h-3.5 w-3.5" aria-hidden />
                    )}
                    <span className={cn(seat.isYou && "font-medium")}>{seat.name}</span>
                    {seat.isYou && <Badge variant="outline">You</Badge>}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">{money(seat.npv)}</td>
                <td className="p-3 text-right tabular-nums">{seat.overall}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Rubric({ seat }: { seat: DebriefSeat }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">How you ran the firm</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {seat.scores.map((dim) => (
          <Card key={dim.key} className="space-y-1.5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{dim.label}</span>
              <span className="text-sm tabular-nums">{dim.value}</span>
            </div>
            <Progress value={dim.value} />
            <p className="text-[11px] leading-snug text-muted-foreground">{dim.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {seat.kpis.map((kpi) => (
          <Card key={kpi.key} className="p-3">
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-base font-semibold tabular-nums">
              {kpi.key === "evNpv"
                ? money(kpi.value / 1_000)
                : formatValue(kpi.value, kpi.unit as "percent")}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** Recharts wants one row per x, so transpose the per-firm price series. */
function toRows(data: ArenaDebriefData): Record<string, number | string>[] {
  const length = Math.max(0, ...data.priceHistory.map((f) => f.prices.length));
  return Array.from({ length }, (_, q) => {
    const row: Record<string, number | string> = { quarter: `Q${q + 1}` };
    for (const firm of data.priceHistory) row[firm.name] = firm.prices[q] ?? 0;
    return row;
  });
}

const SERIES = ["#2563eb", "#f59e0b", "#10b981", "#ef4444"];

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

