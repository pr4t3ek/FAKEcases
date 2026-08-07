"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Target } from "lucide-react";
import { toast } from "sonner";
import { commitDecision } from "@/app/actions/simulations";
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
import { Input } from "@/components/ui/input";
import { GlossaryTerm } from "./glossary-term";
import { Progress } from "@/components/ui/progress";
import { simConfig } from "@/lib/config/simulation";
import { cn, toIndianWords } from "@/lib/utils";
import type { ClientCause, ClientIntervention, ClientScenario } from "@/lib/sim/types";
import { moneyScaleFor } from "./money";
import { SelectionRow } from "./selection-row";

interface Draft {
  sprints: number;
  /** In the scenario's money unit (lakh or crore) — see `moneyScaleFor`. */
  money: number;
}

/**
 * Name the cause, then commit the quarter.
 *
 * Both halves are irreversible and the dialog says so before confirming. That
 * matters more than usual here: the point of the exercise is committing under
 * uncertainty, and an undo button would turn it into a search.
 */
export function CommitPanel({
  runId,
  scenario,
}: {
  runId: string;
  scenario: ClientScenario;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [named, setNamed] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [confirming, setConfirming] = useState(false);

  const roots = scenario.causes.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => scenario.causes.filter((c) => c.parentId === id);

  // Follows the scenario: a ₹6 lakh budget is worked in lakh, a ₹12 crore one
  // in crore. Hardcoding either makes the other unusable.
  const scale = moneyScaleFor(scenario.budget.rupees);
  const budgetMoney = scenario.budget.rupees / scale.divisor;

  const used = useMemo(() => {
    let sprints = 0;
    let money = 0;
    for (const line of Object.values(draft)) {
      sprints += line.sprints;
      money += line.money;
    }
    return { sprints, money };
  }, [draft]);

  const overSprints = used.sprints > scenario.budget.sprints;
  const overBudget = used.money > budgetMoney + 1e-9;
  const fundedCount = Object.values(draft).filter((d) => d.sprints > 0 || d.money > 0).length;
  const canCommit = named.length > 0 && fundedCount > 0 && !overSprints && !overBudget;

  function toggleCause(id: string) {
    setNamed((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= simConfig.maxCausesNamed) {
        toast.error(`Name at most ${simConfig.maxCausesNamed} — a list of everything predicts nothing`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function setLine(id: string, patch: Partial<Draft>) {
    setDraft((prev) => ({
      ...prev,
      [id]: { ...{ sprints: 0, money: 0 }, ...prev[id], ...patch },
    }));
  }

  function commit() {
    const allocation = Object.entries(draft)
      .filter(([, d]) => d.sprints > 0 || d.money > 0)
      .map(([interventionId, d]) => ({
        interventionId,
        sprints: d.sprints,
        // Back to absolute rupees at the boundary; the UI works in whatever
        // unit this scenario's budget is actually discussed in.
        rupees: Math.round(d.money * scale.divisor),
      }));

    startTransition(async () => {
      const result = await commitDecision(runId, named, allocation);
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error ?? "Could not commit");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> What was actually driving the drop?
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick up to {simConfig.maxCausesNamed}. Name the specific branch — the headings are
          there to group them, not to be picked. Nothing here is final until you commit the
          quarter.
        </p>

        <SelectionRow
          selected={named.map((id) => ({
            id,
            label: scenario.causes.find((c) => c.id === id)?.label ?? id,
          }))}
          onRemove={toggleCause}
          emptyHint="Nothing named yet — pick the branch you think was driving it."
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {roots.map((root) => (
            <Card key={root.id} className="p-3">
              <div className="text-xs font-medium text-muted-foreground">{root.label}</div>
              <div className="mt-2 space-y-1.5">
                {/* Children only. The root is the card heading directly above,
                    and injecting it here as well — relabelled "Somewhere in
                    {area}" — read as a duplicate of that heading and gave people
                    a hedge that is not a diagnosis. `diagnosisSchema` refuses a
                    root now, so this is the picker agreeing with the rule. */}
                {childrenOf(root.id).map((cause: ClientCause) => {
                  const selected = named.includes(cause.id);
                  return (
                    <button
                      key={cause.id}
                      type="button"
                      onClick={() => toggleCause(cause.id)}
                      className={cn(
                        "w-full rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 font-medium text-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      {cause.label}
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Commit the quarter</h2>
          <div className="flex gap-4 text-xs tabular-nums">
            <span className={cn(overSprints && "font-medium text-destructive")}>
              {used.sprints}/{scenario.budget.sprints} sprints
            </span>
            <span className={cn(overBudget && "font-medium text-destructive")}>
              ₹{used.money.toFixed(1)}/{budgetMoney.toFixed(budgetMoney % 1 === 0 ? 0 : 1)}{" "}
              {scale.short}
            </span>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Progress
            value={(used.sprints / Math.max(1, scenario.budget.sprints)) * 100}
            indicatorClassName={overSprints ? "bg-destructive" : undefined}
          />
          <Progress
            value={(used.money / Math.max(1, budgetMoney)) * 100}
            indicatorClassName={overBudget ? "bg-destructive" : undefined}
          />
        </div>

        <div className="mt-4 space-y-3">
          {scenario.interventions.map((iv: ClientIntervention) => {
            const line = draft[iv.id] ?? { sprints: 0, money: 0 };
            const funded = line.sprints > 0 || line.money > 0;
            const ask = iv.cost.rupees / scale.divisor;
            const shortOfMin = iv.minSprints !== undefined && funded && line.sprints < iv.minSprints;

            return (
              <Card key={iv.id} className={cn("p-4", funded && "border-primary/40")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{iv.label}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{iv.pitch}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="muted">
                      asks {iv.cost.sprints} sprint{iv.cost.sprints === 1 ? "" : "s"} · ₹
                      {toIndianWords(iv.cost.rupees)}
                    </Badge>
                    {/* Zeroing two number fields by hand is a fiddly way to undo
                        a mistyped line, and mistyping is the whole complaint. */}
                    {funded && (
                      <button
                        type="button"
                        onClick={() => setLine(iv.id, { sprints: 0, money: 0 })}
                        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="text-muted-foreground">
                      <GlossaryTerm>Sprints</GlossaryTerm>
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={scenario.budget.sprints}
                      step={1}
                      value={line.sprints}
                      onChange={(e) =>
                        setLine(iv.id, { sprints: Math.max(0, Math.floor(+e.target.value || 0)) })
                      }
                      className="mt-1 h-9"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">{scale.label}</span>
                    <Input
                      type="number"
                      min={0}
                      max={budgetMoney}
                      step={scale.step}
                      value={line.money}
                      onChange={(e) => setLine(iv.id, { money: Math.max(0, +e.target.value || 0) })}
                      className="mt-1 h-9"
                    />
                  </label>
                </div>

                {/* Named up front rather than discovered in the debrief: the
                    lesson is about choosing to fund fewer things properly, and
                    hiding the threshold would make it a gotcha instead. */}
                {iv.minSprints !== undefined && (
                  <p
                    className={cn(
                      "mt-2 text-[11px]",
                      shortOfMin ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {shortOfMin ? (
                      <>
                        <AlertTriangle className="mr-1 inline h-3 w-3" />
                        Below {iv.minSprints} sprints this ships nothing — the money is still spent.
                      </>
                    ) : (
                      `Ships only at ${iv.minSprints}+ sprints.`
                    )}
                  </p>
                )}
                {funded && line.money < ask && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Part-funded at {Math.round((line.money / ask) * 100)}% of what it asked for.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!canCommit || pending} onClick={() => setConfirming(true)}>
          Commit the quarter
        </Button>
        {!canCommit && (
          <span className="text-xs text-muted-foreground">
            {named.length === 0
              ? "Name a cause first."
              : fundedCount === 0
                ? "Fund at least one intervention."
                : "You are over budget."}
          </span>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Commit and run the quarter?</DialogTitle>
          <DialogDescription>
            This is final — the quarters play out and you see what happened, not whether you were
            right. You are naming{" "}
            <strong>
              {named
                .map((id) => scenario.causes.find((c) => c.id === id)?.label)
                .filter(Boolean)
                .join(" and ")}
            </strong>{" "}
            and committing {used.sprints} sprint{used.sprints === 1 ? "" : "s"} and ₹
            {used.money.toFixed(1)} {scale.short} across {fundedCount} intervention
            {fundedCount === 1 ? "" : "s"}.
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Keep working
            </Button>
            <Button onClick={commit} disabled={pending}>
              {pending ? "Running the quarter…" : "Commit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
