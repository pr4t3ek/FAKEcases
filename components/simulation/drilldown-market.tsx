"use client";

import { useState, useTransition } from "react";
import { Check, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { buyDrilldown } from "@/app/actions/simulations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ClientDrilldown, SimPanel } from "@/lib/sim/types";

/**
 * The data-pull market.
 *
 * Each card shows what the pull would answer *before* it is bought — without
 * that, spending is a lottery rather than a choice, and choosing is the whole
 * exercise. Prices are shown in analyst-days, and a pull you cannot afford is
 * disabled with the reason rather than silently inert.
 */
export function DrilldownMarket({
  runId,
  drilldowns,
  remaining,
  onRevealed,
}: {
  runId: string;
  drilldowns: ClientDrilldown[];
  remaining: number;
  onRevealed: (drilldownId: string, panels: SimPanel[], daysSpent: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [buying, setBuying] = useState<string | null>(null);
  /**
   * Buying is the one action here that cannot be taken back, and it used to
   * fire on a single click. A pull costs up to half the budget, so the
   * confirmation is worth the friction — and restating the question it answers
   * makes it a genuine last check rather than a speed bump.
   */
  const [confirming, setConfirming] = useState<ClientDrilldown | null>(null);

  function buy(d: ClientDrilldown) {
    setBuying(d.id);
    startTransition(async () => {
      const result = await buyDrilldown(runId, d.id);
      setBuying(null);
      setConfirming(null);
      if (!result.ok) {
        toast.error(result.error ?? "That request was refused");
        return;
      }
      onRevealed(d.id, result.reveals ?? [], result.daysSpent ?? 0);
      toast.success(`${d.label} — ${d.cost} analyst-day${d.cost === 1 ? "" : "s"} spent`);
    });
  }

  const available = drilldowns.filter((d) => !d.owned);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" /> Analyses you can run
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {remaining} analyst-day{remaining === 1 ? "" : "s"} left
        </span>
      </div>

      {available.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You&apos;ve run every analysis available. Time to decide.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {available.map((d) => {
          const affordable = d.cost <= remaining;
          const blocked = !d.unlocked || !affordable;
          /**
           * Only ever two reasons, and neither is your hypothesis.
           *
           * Worth saying out loud because the padlock invited the opposite
           * reading: a candidate who had named demand and found the supply
           * pull locked concluded the board was restricted to the branch they
           * had committed to. It never has been — `priceDrilldown` consults the
           * phase, the dependency chain and the budget, and nothing else. Any
           * analysis on any branch is buyable at any time, which is what makes
           * it possible to disprove your own hypothesis.
           *
           * Naming the prerequisite rather than gesturing at it: "the analysis
           * this depends on" is a hunt across nine other cards.
           */
          const blockedBy = (d.dependsOn ?? [])
            .filter((dep) => !drilldowns.find((x) => x.id === dep)?.owned)
            .map((dep) => drilldowns.find((x) => x.id === dep)?.label)
            .filter(Boolean);
          const reason = !d.unlocked
            ? blockedBy.length
              ? `Run “${blockedBy.join("” and “")}” first — this one reads off it`
              : "Run the analysis this depends on first"
            : !affordable
              ? `Needs ${d.cost} analyst-days — you have ${remaining}`
              : undefined;

          return (
            <Card
              key={d.id}
              className={cn(
                "flex flex-col p-4 transition-shadow",
                !blocked && "hover:shadow-md",
                blocked && "opacity-60",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium leading-snug">{d.label}</h3>
                <Badge variant={affordable ? "secondary" : "muted"} className="shrink-0">
                  {d.cost}d
                </Badge>
              </div>
              <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{d.question}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                disabled={blocked || pending}
                title={reason}
                // The visible label is "Run this (3d)" on every card, which
                // reads as ten identical buttons to anyone not looking at the
                // heading above it. The accessible name carries the pull, and
                // the reason it is unavailable when it is.
                aria-label={
                  reason
                    ? `${d.label} — ${reason}`
                    : `Run ${d.label} for ${d.cost} analyst-day${d.cost === 1 ? "" : "s"}`
                }
                onClick={() => setConfirming(d)}
              >
                {!d.unlocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Locked
                  </>
                ) : buying === d.id ? (
                  "Running…"
                ) : (
                  `Run this (${d.cost}d)`
                )}
              </Button>
              {/* Shown for a dependency lock too, which it was not before —
                  the visible reason was gated on `d.unlocked`, so the one card
                  that says nothing but "Locked" was the only one that never
                  explained itself. A tooltip is not an explanation on touch. */}
              {reason && (
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{reason}</p>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Run &ldquo;{confirming?.label}&rdquo;?</DialogTitle>
          <DialogDescription>
            It answers: <em>{confirming?.question}</em>
            <br />
            <br />
            This costs{" "}
            <strong>
              {confirming?.cost} of your {remaining} remaining analyst-day
              {remaining === 1 ? "" : "s"}
            </strong>
            , leaving {Math.max(0, remaining - (confirming?.cost ?? 0))}. Analyst-days can&apos;t be
            recovered once spent.
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={pending}>
              Not this one
            </Button>
            <Button onClick={() => confirming && buy(confirming)} disabled={pending}>
              {pending ? "Running…" : `Run it (${confirming?.cost}d)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {drilldowns.some((d) => d.owned) && (
        <div className="pt-2">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Already run</h3>
          <div className="flex flex-wrap gap-1.5">
            {drilldowns
              .filter((d) => d.owned)
              .map((d) => (
                <Badge key={d.id} variant="success" className="gap-1">
                  <Check className="h-3 w-3" /> {d.label}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
