"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock, Target } from "lucide-react";
import { toast } from "sonner";
import { commitDecision, lockDiagnosis } from "@/app/actions/simulations";
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
import { MoneyDial } from "./money-dial";
import { Progress } from "@/components/ui/progress";
import { simConfig } from "@/lib/config/simulation";
import { cn, toIndianWords } from "@/lib/utils";
import type { ClientCause, ClientIntervention, ClientScenario } from "@/lib/sim/types";
import { formatValue } from "./format";
import { moneyScaleFor } from "./money";
import type { SimulationPeriods } from "./types";
import { SelectionRow } from "./selection-row";

interface Draft {
  sprints: number;
  /** In the scenario's money unit (lakh or crore) — see `moneyScaleFor`. */
  money: number;
}

/**
 * Name the cause, then fund what treats it.
 *
 * Two steps, and the order is the lesson. Until a cause is named the server has
 * sent no interventions at all; naming one narrows the board to the fixes that
 * address it, and nothing else can be bought. A run that diagnoses the wrong
 * branch can no longer stumble onto the right fix — which it could before, and
 * scored full marks for.
 *
 * Both steps are irreversible and both dialogs say so. That matters more than
 * usual here: the point of the exercise is committing under uncertainty, and an
 * undo button would turn it into a search. It is also load-bearing for the first
 * step specifically — a re-namable diagnosis would let anyone read the answer off
 * the size of each slate, since the true cause usually has more fixes behind it
 * than a decoy.
 */
export function CommitPanel({
  runId,
  scenario,
  diagnosis,
  periods,
}: {
  runId: string;
  scenario: ClientScenario;
  /** Causes already locked. Empty means step one. */
  diagnosis: string[];
  /** Absent on a war room that commits once — see `SimulationPeriods`. */
  periods?: SimulationPeriods;
}) {
  const locked = diagnosis.length > 0;
  return locked ? (
    <FundStep runId={runId} scenario={scenario} diagnosis={diagnosis} periods={periods} />
  ) : (
    <NameStep runId={runId} scenario={scenario} />
  );
}

const labelFor = (scenario: ClientScenario, id: string) =>
  scenario.causes.find((c) => c.id === id)?.label ?? id;

/**
 * What the commit button says, which has to name what actually happens.
 *
 * Four different actions wear this one control: running the quarters out,
 * settling one period of several, deliberately holding a period, and holding
 * because the named cause has no fix on the board. Calling them all "Commit the
 * quarter" would make the mid-run ones read as final, which is the misreading
 * that matters — a student who thinks the run ends here will empty the pool.
 */
function commitLabel(args: {
  nothingToFund: boolean;
  fundedCount: number;
  periods?: SimulationPeriods;
  periodNoun: string;
  lastPeriod: boolean;
}): string {
  const { nothingToFund, fundedCount, periods, periodNoun, lastPeriod } = args;
  if (nothingToFund) return "Hold the capacity and run the quarter";
  if (!periods) return "Commit the quarter";
  if (fundedCount === 0) return `Hold this ${periodNoun}`;
  return lastPeriod
    ? `Commit the last ${periodNoun} and run it out`
    : `Commit ${periodNoun} ${periods.open + 1}`;
}

/**
 * The name of something already funded. Falls back to the id rather than
 * dropping the line: a committed rupee the summary cannot name is still a
 * committed rupee, and hiding it would make the pool arithmetic look wrong.
 */
const interventionLabel = (scenario: ClientScenario, id: string) =>
  scenario.interventions.find((iv) => iv.id === id)?.label ?? id;

// ── Step one: name the cause ─────────────────────────────────────────────────

function NameStep({ runId, scenario }: { runId: string; scenario: ClientScenario }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [named, setNamed] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const roots = scenario.causes.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => scenario.causes.filter((c) => c.parentId === id);

  function toggleCause(id: string) {
    setNamed((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= simConfig.maxCausesNamed) {
        toast.error(
          `Name at most ${simConfig.maxCausesNamed} — a list of everything predicts nothing`,
        );
        return prev;
      }
      return [...prev, id];
    });
  }

  function lock() {
    startTransition(async () => {
      const result = await lockDiagnosis(runId, named);
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error ?? "Could not lock the diagnosis");
        return;
      }
      // The permitted interventions arrive through the ordinary page render —
      // there is no second payload to trust.
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
          there to group them, not to be picked. This is your answer, not your opening
          hypothesis: name whatever the data ended up saying.{" "}
          <span className="font-medium text-foreground">
            This decides what you are allowed to spend on.
          </span>{" "}
          Only the fixes that treat what you name will be offered, so a wrong call here cannot
          be bought back later.
        </p>

        <SelectionRow
          selected={named.map((id) => ({ id, label: labelFor(scenario, id) }))}
          onRemove={toggleCause}
          emptyHint="Nothing named yet — pick the branch you think was driving it."
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {roots.map((root) => (
            <Card key={root.id} className="p-3">
              <div className="text-xs font-medium text-muted-foreground">{root.label}</div>
              <div className="mt-2 space-y-1.5">
                {/* Children only. The root is the heading directly above, and
                    injecting it here as well — as "Somewhere in {area}" — read as
                    a duplicate of that heading and offered a hedge that is not a
                    diagnosis. `diagnosisSchema` refuses a root outright. */}
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

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!named.length || pending} onClick={() => setConfirming(true)}>
          <Lock /> Name it and see the options
        </Button>
        {!named.length && (
          <span className="text-xs text-muted-foreground">Name a cause first.</span>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Lock this diagnosis?</DialogTitle>
          <DialogDescription>
            You are naming{" "}
            <strong>{named.map((id) => labelFor(scenario, id)).join(" and ")}</strong>. This
            locks. After it, the only fixes on the board are the ones that target what you have
            named — if you have named the wrong thing, you will not be able to buy your way out
            of it.
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Keep looking
            </Button>
            <Button onClick={lock} disabled={pending}>
              {pending ? "Locking…" : "Lock it in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Step two: fund what treats it ────────────────────────────────────────────

function FundStep({
  runId,
  scenario,
  diagnosis,
  periods,
}: {
  runId: string;
  scenario: ClientScenario;
  diagnosis: string[];
  periods?: SimulationPeriods;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [confirming, setConfirming] = useState(false);

  // Follows the scenario: a ₹6 lakh budget is worked in lakh, a ₹12 crore one
  // in crore. Hardcoding either makes the other unusable.
  const scale = moneyScaleFor(scenario.budget.rupees);
  /**
   * What can still be committed, which on a multi-period run is the pool rather
   * than the budget. Capacity has no equivalent: it refreshes every period, so
   * the meter below is against the whole team every time.
   */
  const budgetMoney = (periods?.moneyRemaining ?? scenario.budget.rupees) / scale.divisor;
  const lastPeriod = !periods || periods.open === periods.total - 1;
  const periodNoun = scenario.periodNoun;

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

  /**
   * Nothing on this board addresses what they named.
   *
   * Not a bug and not a dead end: some causes are honestly unfixable — there is
   * no intervention that answers a monsoon — and the scenario says so with
   * `SimCause.unactionable`. Holding the capacity is then the correct answer,
   * and an empty allocation runs the do-nothing path, which is what actually
   * happens to a quarter nobody could act on.
   */
  const nothingToFund = scenario.interventions.length === 0;
  /**
   * Committing nothing this period is a real answer when there is another
   * period to spend in — waiting for a quarter's results before backing
   * something is half of what the format is asking. On a single commit it is
   * still refused, because there it means abandoning the run.
   */
  const mayHold = nothingToFund || Boolean(periods && !lastPeriod);
  const canCommit = (mayHold || fundedCount > 0) && !overSprints && !overBudget;

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
      // The diagnosis is not sent — the server reads the one it locked, so this
      // request cannot name one cause and fund the fix for another.
      const result = await commitDecision(runId, allocation);
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
      <Card className="border-primary/30 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 text-xs">
            <div className="font-medium">
              You named {diagnosis.map((id) => labelFor(scenario, id)).join(" and ")}
            </div>
            <p className="mt-0.5 text-muted-foreground">
              The board below is what treats it. Nothing else is available.
            </p>
          </div>
        </div>
      </Card>

      {periods && (
        <Card className="p-3">
          <div className="text-xs font-medium">
            The money is one pool; the team comes back every {periodNoun}.
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Whatever you hold back stays available next {periodNoun}, and you will have seen
            another {periodNoun} of results before you spend it. Committing early buys more
            time for a fix to work; committing late buys more certainty about which fix.
          </p>
          {periods.observed.length > 1 && (
            <div className="mt-2 border-t pt-2">
              <div className="text-[11px] font-medium">
                {periods.northStar.label}, as it has come in
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {periods.observed.map((point, index) => {
                  // Against the start rather than the previous reading: the
                  // question a candidate is asking mid-run is whether the metric
                  // has recovered, and a quarter-on-quarter delta answers a
                  // different one.
                  const base = periods.observed[0].value;
                  const change = base === 0 ? null : (point.value - base) / base;
                  return (
                    <div key={point.label} className="text-[11px] tabular-nums">
                      <span className="text-muted-foreground">{point.label}</span>{" "}
                      <span className="font-medium">
                        {formatValue(point.value, periods.northStar.unit)}
                      </span>
                      {index > 0 && change !== null && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({change >= 0 ? "+" : ""}
                          {(change * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                What your committed capacity has actually produced, luck included. There is no
                counterfactual here — whether another call would have done better is the
                question you are still answering.
              </p>
            </div>
          )}
          {periods.committed.length > 0 && (
            <ul className="mt-2 space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
              {periods.committed.map((lines, index) => (
                <li key={index} className="tabular-nums">
                  <span className="font-medium text-foreground">
                    {periodNoun} {index + 1}:
                  </span>{" "}
                  {lines.length === 0
                    ? "held everything"
                    : lines
                        .map(
                          (l) =>
                            `${interventionLabel(scenario, l.interventionId)} — ${l.sprints} sprint${
                              l.sprints === 1 ? "" : "s"
                            }, ₹${(l.rupees / scale.divisor).toFixed(1)} ${scale.short}`,
                        )
                        .join(" · ")}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {periods
              ? `Commit ${periodNoun} ${periods.open + 1} of ${periods.total}`
              : "Commit the quarter"}
          </h2>
          <div className="flex gap-4 text-xs tabular-nums">
            <span className={cn(overSprints && "font-medium text-destructive")}>
              {used.sprints}/{scenario.budget.sprints} sprints
            </span>
            <span className={cn(overBudget && "font-medium text-destructive")}>
              ₹{used.money.toFixed(1)}/{budgetMoney.toFixed(budgetMoney % 1 === 0 ? 0 : 1)}{" "}
              {scale.short}
              {periods && " left"}
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

        {nothingToFund ? (
          <Card className="mt-4 border-dashed p-5 text-sm">
            <div className="font-medium">Nothing on this board fixes that.</div>
            {scenario.unactionableNote && (
              <p className="mt-1.5 text-xs leading-relaxed">{scenario.unactionableNote}</p>
            )}
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              You can commit the quarter with the capacity unspent. That is a real answer, and
              it is the one your diagnosis implies — the quarter will play out as if nobody
              acted, because on your reading of it nobody usefully could.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            {scenario.interventions.map((iv: ClientIntervention) => {
              const line = draft[iv.id] ?? { sprints: 0, money: 0 };
              const funded = line.sprints > 0 || line.money > 0;
              const ask = iv.cost.rupees / scale.divisor;
              const shortOfMin =
                iv.minSprints !== undefined && funded && line.sprints < iv.minSprints;

              return (
                <Card key={iv.id} className={cn("p-4", funded && "border-primary/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium">{iv.label}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {iv.pitch}
                      </p>
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

                  <div className="mt-3">
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
                          setLine(iv.id, {
                            sprints: Math.max(0, Math.floor(+e.target.value || 0)),
                          })
                        }
                        className="mt-1 h-9"
                      />
                    </label>
                  </div>

                  {/* A number box was right while money was linear — there was
                      nothing to feel, because the answer was always "as much as
                      the budget allows". Under a curve the question is where to
                      stop, and you cannot see a knee in a text field. */}
                  <div className="mt-3">
                    <MoneyDial
                      value={line.money}
                      // What is left, plus what this line already holds, so
                      // dragging one line never silently overdraws another.
                      max={Math.max(0, budgetMoney - used.money + line.money)}
                      scale={scale}
                      hint={iv.saturationHint}
                      ask={iv.cost.rupees / scale.divisor}
                      label={iv.label}
                      onChange={(money) => setLine(iv.id, { money })}
                    />
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
                          Below {iv.minSprints} sprints this ships nothing — the money is still
                          spent.
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
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!canCommit || pending} onClick={() => setConfirming(true)}>
          {commitLabel({ nothingToFund, fundedCount, periods, periodNoun, lastPeriod })}
        </Button>
        {!canCommit && (
          <span className="text-xs text-muted-foreground">
            {fundedCount === 0 ? "Fund at least one intervention." : "You are over budget."}
          </span>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>
            {lastPeriod
              ? `Commit and run ${periods ? "it out" : "the quarter"}?`
              : `Commit ${periodNoun} ${(periods?.open ?? 0) + 1}?`}
          </DialogTitle>
          <DialogDescription>
            {lastPeriod ? (
              <>
                This is final — the {periodNoun}s play out and you see what happened, not whether
                you were right.{" "}
              </>
            ) : (
              <>
                This {periodNoun} is settled once you commit it — you will see how it went before
                deciding the next one, and anything you held back is still yours to spend.{" "}
              </>
            )}
            {nothingToFund ? (
              <>You are spending nothing, having named a cause this board cannot act on.</>
            ) : fundedCount === 0 ? (
              <>
                You are committing nothing this {periodNoun} and keeping the whole pool for the
                next one.
              </>
            ) : (
              <>
                You are committing {used.sprints} sprint{used.sprints === 1 ? "" : "s"} and ₹
                {used.money.toFixed(1)} {scale.short} across {fundedCount} intervention
                {fundedCount === 1 ? "" : "s"}.
              </>
            )}
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
