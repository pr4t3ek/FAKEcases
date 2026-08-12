"use client";

import { useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
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
          /**
           * One reason, and it is the budget.
           *
           * The board is open: any analysis, on any branch, in any order. It
           * was never gated on the hypothesis, but it *was* gated on
           * prerequisite pulls, and a padlock does not explain which kind of
           * lock it is — a candidate who had named demand and found the supply
           * pull padlocked read it as the board restricting them to their own
           * branch. Both gates are gone. What is left is analyst-days, which is
           * the constraint the phase is actually about.
           */
          const affordable = d.cost <= remaining;
          const blocked = !affordable;
          const reason = !affordable
            ? `Needs ${d.cost} analyst-days — you have ${remaining}`
            : undefined;

          /**
           * The authored relationship, kept as a hint now that it gates
           * nothing. "These two read together" is worth knowing; "you may not
           * buy this yet" was not.
           */
          const readsWith = (d.dependsOn ?? [])
            .map((dep) => drilldowns.find((x) => x.id === dep)?.label)
            .filter(Boolean);

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
              {readsWith.length > 0 && (
                <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                  Reads alongside “{readsWith.join("” and “")}”
                </p>
              )}
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
                {buying === d.id ? (
                  "Running…"
                ) : (
                  `Run this (${d.cost}d)`
                )}
              </Button>
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
