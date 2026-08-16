"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Package, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { beginSimulator, chooseBranch, submitMonth } from "@/app/actions/simulations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatValue } from "../format";
import type { BuybackData } from "../types";

/**
 * The contract simulator's board.
 *
 * Three columns, which is a third distinct shape after the war room's
 * board-left/work-right and the turnaround's horizontal bands: decisions on the
 * left, the month's story in the middle, the numbers on the right. The split is
 * the argument — what you choose, what you are told, and what it did are three
 * different kinds of information, and mixing them is how a student ends up
 * reading the P&L as if it were a decision.
 *
 * Every control is described by the config. This component knows there are
 * decisions with bounds; it does not know one of them is an order quantity.
 */
export function BuybackScreen({ data }: { data: BuybackData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(data.decisions.map((d) => [d.key, d.value])),
  );

  function begin() {
    startTransition(async () => {
      const r = await beginSimulator(data.runId);
      if (!r.ok) return void toast.error(r.error ?? "Could not start");
      router.refresh();
    });
  }

  function pickBranch(optionId: string) {
    startTransition(async () => {
      const r = await chooseBranch(data.runId, optionId);
      if (!r.ok) return void toast.error(r.error ?? "Could not record that");
      router.refresh();
    });
  }

  function submit() {
    startTransition(async () => {
      const r = await submitMonth(data.runId, values);
      if (!r.ok) return void toast.error(r.error ?? "Could not run the month");
      router.refresh();
    });
  }

  // ── Briefing ────────────────────────────────────────────────────────────
  if (data.phase === "brief") {
    return (
      <div className="min-h-screen bg-muted/20">
        <main className="container max-w-3xl py-10">
          <Badge variant="secondary" className="mb-3">
            Contract simulator · {data.horizon} months
          </Badge>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <Card className="mt-5 border-primary/30 bg-primary/5 p-6">
            <p className="whitespace-pre-line text-sm leading-relaxed">{data.situation}</p>
          </Card>
          <Button className="mt-5" onClick={begin} disabled={pending}>
            Open the contract <ArrowRight />
          </Button>
        </main>
      </div>
    );
  }

  const branchOpen = data.branch && !data.branch.chosen;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container flex items-center gap-3 py-3">
          <Badge variant="secondary">Contract</Badge>
          <span className="truncate text-sm font-medium">{data.title}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            Month {data.monthIndex + 1} of {data.horizon}
          </span>
        </div>
      </header>

      <main className="container grid gap-5 py-6 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        {/* ── Left: what you decide ──────────────────────────────────────── */}
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold">Month {data.monthIndex + 1}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Decide, then the month runs. You cannot revisit it.
            </p>

            <div className="mt-4 space-y-4">
              {data.decisions.map((d) => (
                <label key={d.key} className="block">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium">{d.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {d.kind === "currency"
                        ? formatValue(values[d.key] ?? 0, "inr")
                        : Math.round(values[d.key] ?? 0)}
                    </span>
                  </div>

                  {/* A typed figure for both, quantity and price alike. The
                      quantity used to be a range — a feel for scale — and that
                      is precisely the affordance worth removing: an order you
                      dragged to is an order you never had to name. */}
                  <Input
                    type="number"
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    value={values[d.key] ?? d.value}
                    onChange={(e) => setValues((v) => ({ ...v, [d.key]: +e.target.value }))}
                    className="mt-2 h-9"
                    disabled={pending || !!branchOpen}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.kind === "currency" ? "Any figure" : "Whole units"} from {d.min} to {d.max}.
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{d.help}</p>
                </label>
              ))}
            </div>

            <Button
              className="mt-5 w-full"
              onClick={submit}
              disabled={pending || !!branchOpen}
            >
              Run month {data.monthIndex + 1} <ArrowRight />
            </Button>
            {branchOpen && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-500">
                Settle the decision in the middle column first.
              </p>
            )}
          </Card>

          {data.branch && (
            <Card className={cn("p-4", branchOpen && "border-primary bg-primary/5")}>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <GitBranch className="h-4 w-4 text-primary" /> A decision to make
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed">{data.branch.prompt}</p>
              <div className="mt-3 space-y-2">
                {data.branch.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={pending || !!data.branch?.chosen}
                    onClick={() => pickBranch(o.id)}
                    className={cn(
                      "w-full rounded-md border p-2.5 text-left transition-colors",
                      data.branch?.chosen === o.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent disabled:opacity-60",
                    )}
                  >
                    <div className="text-xs font-medium">{o.label}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {o.detail}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </aside>

        {/* ── Middle: what you are told ──────────────────────────────────── */}
        <section className="space-y-4">
          {data.narrative.map((n) => (
            <Card key={n.id} className="border-amber-300/60 bg-amber-50/60 p-4 dark:bg-amber-950/20">
              <h3 className="text-sm font-semibold">{n.headline}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
            </Card>
          ))}

          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">What your supplier is offering</h2>
              <Badge variant="secondary" className="text-[10px]">{data.quote.stance}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Quoted for month {data.monthIndex + 1}. They requote every month.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Wholesale price", value: data.quote.wholesalePrice, unit: "inr" as const },
                { label: "Buyback price", value: data.quote.buybackPrice, unit: "inr" as const },
                { label: "Share they take back", value: data.quote.buybackShare, unit: "ratio" as const },
              ].map((q) => (
                <div key={q.label} className="rounded-md border p-2.5">
                  <div className="text-[11px] text-muted-foreground">{q.label}</div>
                  <div className="mt-0.5 text-base font-semibold tabular-nums">
                    {formatValue(q.value, q.unit)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold">What you can see</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The market itself is not on this list. You infer it from what these do.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.signals.map((s) => (
                <div key={s.key} className="flex items-baseline justify-between rounded-md border px-2.5 py-2">
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                  <span className="text-xs font-semibold tabular-nums">
                    {formatValue(s.value, s.unit)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* ── Right: what it did ─────────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {data.kpis.map((k) => {
              const good = k.goodDirection === "up" ? k.value >= 0 : k.value <= 0;
              return (
                <Card key={k.key} className="p-3">
                  <div className="text-[11px] leading-tight text-muted-foreground">{k.label}</div>
                  <div
                    className={cn(
                      "mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums",
                      k.key === "npv" && (good ? "text-emerald-600" : "text-red-600"),
                    )}
                  >
                    {k.key === "npv" &&
                      (good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                    {formatValue(k.value, k.unit)}
                  </div>
                </Card>
              );
            })}
          </div>

          {data.trends.length > 1 && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">How the year is going</h2>
              {[
                { key: "cash", label: "Cash", colour: "hsl(var(--primary))" },
                { key: "unitsSold", label: "Units sold", colour: "#10b981" },
                { key: "inventory", label: "Stock left over", colour: "#f59e0b" },
              ].map((series) => (
                <div key={series.key} className="mb-3 last:mb-0">
                  <div className="mb-1 text-[11px] text-muted-foreground">{series.label}</div>
                  <ResponsiveContainer width="100%" height={70}>
                    <LineChart data={data.trends} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                      <XAxis dataKey="period" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <RechartsTooltip
                        contentStyle={{ fontSize: 11 }}
                        formatter={(v: number) => formatValue(v, series.key === "cash" ? "inr" : "count")}
                      />
                      <Line
                        type="monotone"
                        dataKey={series.key}
                        stroke={series.colour}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </Card>
          )}

          {data.statements && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Last month, three ways</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                A profitable month and a collected month are not the same month.
              </p>
              <div className="mt-3 space-y-3">
                {[
                  { title: "Profit & loss", rows: data.statements.pnl },
                  { title: "Balance sheet", rows: data.statements.balance },
                  { title: "Cash flow", rows: data.statements.cashFlow },
                ].map((block) => (
                  <details key={block.title} className="rounded-md border">
                    <summary className="cursor-pointer px-2.5 py-2 text-xs font-medium">
                      {block.title}
                    </summary>
                    <div className="border-t px-2.5 py-2">
                      {block.rows.map((r) => (
                        <div
                          key={r.label}
                          className={cn(
                            "flex justify-between py-0.5 text-[11px]",
                            r.emphasis && "font-semibold",
                          )}
                        >
                          <span className={cn(!r.emphasis && "text-muted-foreground")}>{r.label}</span>
                          <span className="tabular-nums">{formatValue(r.value, "inr")}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </Card>
          )}

          {data.trends.length === 0 && (
            <Card className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
              <Package className="h-4 w-4" /> Nothing has happened yet. Run month 1.
            </Card>
          )}
        </aside>
      </main>
    </div>
  );
}
