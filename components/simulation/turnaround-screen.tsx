"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { beginTurnaround, commitPeriod } from "@/app/actions/simulations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ConceptPrimer } from "./concept-primer";
import { GlossaryProvider } from "./glossary-term";
import { MetricMap } from "./metric-map";
import { SimDashboard, formatValue } from "./sim-dashboard";
import type { TurnaroundData } from "./types";

/**
 * The turnaround board.
 *
 * Laid out as horizontal bands — a timeline of quarters across the top, the
 * quarter that just landed beneath it, then the allocation for the quarter you
 * are deciding now — rather than the war room's board-left / work-right split.
 * That is deliberate and is half the reason the format exists: a second format
 * wearing the first one's chrome would still feel like the first one.
 *
 * The timeline is the spine. It shows what you committed and what happened, so
 * the decision in front of you is read against the ones behind it rather than in
 * isolation.
 */
export function TurnaroundScreen({ data }: { data: TurnaroundData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [primerOpen, setPrimerOpen] = useState(
    !!data.teaching && data.phase === "brief",
  );
  const [confirming, setConfirming] = useState(false);

  /** interventionId → { sprints, rupees } for the open period. */
  const [draft, setDraft] = useState<Record<string, { sprints: number; rupees: number }>>({});

  const noun = data.periodNoun === "month" ? "month" : "quarter";
  const open = data.openPeriod;

  const totals = useMemo(() => {
    let sprints = 0;
    let rupees = 0;
    for (const line of Object.values(draft)) {
      sprints += line.sprints;
      rupees += line.rupees;
    }
    return { sprints, rupees };
  }, [draft]);

  const overSprints = totals.sprints > data.budget.sprints;
  const overMoney = totals.rupees > data.budget.rupees;
  const funded = Object.values(draft).filter((l) => l.sprints > 0 || l.rupees > 0).length;
  const canCommit = !overSprints && !overMoney;

  function setLine(id: string, patch: Partial<{ sprints: number; rupees: number }>) {
    setDraft((prev) => ({
      ...prev,
      [id]: { sprints: prev[id]?.sprints ?? 0, rupees: prev[id]?.rupees ?? 0, ...patch },
    }));
  }

  function begin() {
    startTransition(async () => {
      const result = await beginTurnaround(data.runId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not start");
        return;
      }
      router.refresh();
    });
  }

  function commit() {
    startTransition(async () => {
      const lines = Object.entries(draft)
        .filter(([, l]) => l.sprints > 0 || l.rupees > 0)
        .map(([interventionId, l]) => ({ interventionId, ...l }));
      const result = await commitPeriod(data.runId, lines);
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error ?? "Could not commit");
        return;
      }
      setDraft({});
      router.refresh();
    });
  }

  // ── The briefing ────────────────────────────────────────────────────────
  if (data.phase === "brief") {
    return (
      <GlossaryProvider teaching={data.teaching}>
        <div className="min-h-screen bg-muted/20">
          {data.teaching && (
            <ConceptPrimer
              teaching={data.teaching}
              open={primerOpen}
              onOpenChange={setPrimerOpen}
              onStart={() => setPrimerOpen(false)}
            />
          )}
          <main className="container max-w-3xl py-10">
            <Badge variant="secondary" className="mb-3">
              Turnaround · {data.periods.length} {noun}s
            </Badge>
            <h1 className="text-2xl font-semibold">{data.title}</h1>
            <Card className="mt-5 border-primary/30 bg-primary/5 p-6">
              <p className="whitespace-pre-line text-sm leading-relaxed">{data.situation}</p>
            </Card>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={begin} disabled={pending}>
                Take the job <ArrowRight />
              </Button>
              {data.teaching && (
                <Button variant="secondary" onClick={() => setPrimerOpen(true)} disabled={pending}>
                  Read the concepts first
                </Button>
              )}
            </div>
          </main>
        </div>
      </GlossaryProvider>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────
  const lastDone = [...data.periods].reverse().find((p) => p.state === "done");

  return (
    <GlossaryProvider teaching={data.teaching}>
      <div className="min-h-screen bg-muted/20">
        {data.teaching && (
          <ConceptPrimer teaching={data.teaching} open={primerOpen} onOpenChange={setPrimerOpen} />
        )}

        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="container flex items-center gap-3 py-3">
            <Badge variant="secondary">Turnaround</Badge>
            <span className="truncate text-sm font-medium">{data.title}</span>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {open !== null ? (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  Deciding {noun} {open + 1} of {data.periods.length}
                </>
              ) : (
                <>All {data.periods.length} decided</>
              )}
            </div>
            {data.teaching && (
              <Button size="sm" variant="ghost" onClick={() => setPrimerOpen(true)}>
                Concepts
              </Button>
            )}
          </div>
        </header>

        <main className="container space-y-6 py-6">
          {/* ── Band 1: the spine ────────────────────────────────────────── */}
          <section>
            <h2 className="mb-2 text-sm font-semibold">The sequence so far</h2>
            <div className="grid gap-3 md:grid-cols-4">
              {data.periods.map((p) => (
                <Card
                  key={p.period}
                  className={cn(
                    "p-3 transition-colors",
                    p.state === "open" && "border-primary bg-primary/5",
                    p.state === "future" && "opacity-55",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{p.label}</span>
                    {p.state === "done" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                    {p.state === "open" && (
                      <Badge className="h-5 px-1.5 text-[10px]">deciding</Badge>
                    )}
                    {p.state === "future" && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>

                  {p.committed.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {p.committed.map((c) => (
                        <li key={c.label} className="text-[11px] leading-snug text-muted-foreground">
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] italic text-muted-foreground">
                      {p.state === "done" ? "Held the capacity" : "—"}
                    </p>
                  )}

                  {p.metrics.length > 0 && (
                    <div className="mt-2.5 space-y-1 border-t pt-2">
                      {p.metrics.slice(0, 2).map((m) => (
                        <div key={m.driver} className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">{m.label}</span>
                          <span className="text-xs font-semibold tabular-nums">
                            {formatValue(m.value, m.unit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {/* ── Band 2: what just landed ─────────────────────────────────── */}
          {lastDone && lastDone.metrics.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">
                Where the business stands after {lastDone.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {lastDone.metrics.map((m) => {
                  const up = (m.deltaPct ?? 0) >= 0;
                  const good = m.goodDirection === "down" ? !up : up;
                  return (
                    <Card key={m.driver} className="p-3">
                      <div className="text-[11px] text-muted-foreground">{m.label}</div>
                      <div className="mt-0.5 text-lg font-semibold tabular-nums">
                        {formatValue(m.value, m.unit)}
                      </div>
                      {m.deltaPct !== undefined && (
                        <div
                          className={cn(
                            "mt-0.5 flex items-center gap-1 text-[11px]",
                            good ? "text-emerald-600" : "text-red-600",
                          )}
                        >
                          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {(m.deltaPct * 100).toFixed(1)}% vs start
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Band 3: the decision ─────────────────────────────────────── */}
          {open !== null && (
            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  What do you fund in {noun} {open + 1}?
                </h2>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className={cn(overSprints && "font-semibold text-red-600")}>
                    {totals.sprints} / {data.budget.sprints} sprints
                  </span>
                  <span className={cn(overMoney && "font-semibold text-red-600")}>
                    {formatValue(totals.rupees, "inr")} / {formatValue(data.budget.rupees, "inr")}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Capacity does not carry over — whatever you leave unspent this {noun} is gone.
              </p>

              <div className="grid gap-3 lg:grid-cols-2">
                {data.interventions.map((iv) => {
                  const line = draft[iv.id] ?? { sprints: 0, rupees: 0 };
                  const on = line.sprints > 0 || line.rupees > 0;
                  return (
                    <Card key={iv.id} className={cn("p-4", on && "border-primary/60 bg-primary/5")}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium leading-snug">{iv.label}</h3>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {iv.cost.sprints} sp · {formatValue(iv.cost.rupees, "inr")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{iv.pitch}</p>
                      {iv.minSprints !== undefined && (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">
                          Ships nothing below {iv.minSprints} sprints.
                        </p>
                      )}

                      <div className="mt-3 flex items-end gap-2">
                        <label className="flex-1 text-[11px]">
                          <span className="text-muted-foreground">Sprints</span>
                          <Input
                            type="number"
                            min={0}
                            max={data.budget.sprints}
                            step={1}
                            value={line.sprints}
                            onChange={(e) =>
                              setLine(iv.id, { sprints: Math.max(0, Math.floor(+e.target.value || 0)) })
                            }
                            className="mt-1 h-9"
                          />
                        </label>
                        <label className="flex-1 text-[11px]">
                          <span className="text-muted-foreground">₹ lakh</span>
                          <Input
                            type="number"
                            min={0}
                            step={5}
                            value={line.rupees / 100_000}
                            onChange={(e) =>
                              setLine(iv.id, { rupees: Math.max(0, (+e.target.value || 0) * 100_000) })
                            }
                            className="mt-1 h-9"
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="mb-[1px]"
                          onClick={() =>
                            setLine(iv.id, { sprints: iv.cost.sprints, rupees: iv.cost.rupees })
                          }
                        >
                          Fund it
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button disabled={!canCommit || pending} onClick={() => setConfirming(true)}>
                  {funded === 0 ? `Hold everything and run the ${noun}` : `Run the ${noun}`}
                  <ArrowRight />
                </Button>
                {!canCommit && (
                  <span className="text-xs text-red-600">
                    That is more than you have this {noun}.
                  </span>
                )}
              </div>
            </section>
          )}

          {/* ── Band 4: the model and the opening board ──────────────────── */}
          {data.metricMap && <MetricMap nodes={data.metricMap} highlight={data.metricMap.at(-1)?.id} />}
          <section>
            <h2 className="mb-2 text-sm font-semibold">The company as you found it</h2>
            <SimDashboard panels={data.panels} />
          </section>
        </main>

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Run {noun} {(open ?? 0) + 1}?</DialogTitle>
            <DialogDescription>
              {funded === 0 ? (
                <>
                  You are funding nothing this {noun}. That is a decision — drift is not free, and
                  the capacity does not carry over.
                </>
              ) : (
                <>
                  You are committing <strong>{totals.sprints} sprints</strong> and{" "}
                  <strong>{formatValue(totals.rupees, "inr")}</strong> across {funded} option
                  {funded === 1 ? "" : "s"}. You cannot revisit this {noun} once it has run.
                </>
              )}
            </DialogDescription>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
                Keep deciding
              </Button>
              <Button onClick={commit} disabled={pending}>
                {pending ? "Running…" : `Run the ${noun}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GlossaryProvider>
  );
}
