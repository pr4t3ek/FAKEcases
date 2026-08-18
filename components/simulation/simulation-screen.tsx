"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lightbulb, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { commitHypothesis, openDecision } from "@/app/actions/simulations";
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
import { Textarea } from "@/components/ui/textarea";
import { simConfig } from "@/lib/config/simulation";
import { cn } from "@/lib/utils";
import type { SimPanel } from "@/lib/sim/types";
import { CommitPanel } from "./commit-panel";
import { ConceptPrimer } from "./concept-primer";
import { GlossaryProvider } from "./glossary-term";
import { DrilldownMarket } from "./drilldown-market";
import { MetricMap } from "./metric-map";
import { SelectionRow } from "./selection-row";
import { SimDashboard } from "./sim-dashboard";
import { SimHeader } from "./sim-header";
import type { SimulationData } from "./types";

/**
 * The live run: the board on the left, the phase's work on the right.
 *
 * State is local and thin — purchased panels are appended as they arrive rather
 * than refetched, because the server has already told us exactly what was
 * revealed, and a round-trip would make a two-second pull feel like four.
 */
export function SimulationScreen({ data }: { data: SimulationData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [panels, setPanels] = useState<SimPanel[]>(data.scenario.panels);
  const [drilldowns, setDrilldowns] = useState(data.scenario.drilldowns);
  const [daysSpent, setDaysSpent] = useState(data.daysSpent);

  const [suspects, setSuspects] = useState<string[]>(data.hypothesis);
  const [note, setNote] = useState(data.hypothesisNote ?? "");

  const teaching = data.scenario.teaching;
  // Opens on arrival at Observe, when nothing has been committed yet. Later
  // phases mean the student has already seen it, so it stays out of the way
  // behind the header button.
  const [primerOpen, setPrimerOpen] = useState(!!teaching && data.phase === "observe");

  // Revisable for as long as the investigation is open — see
  // `hypothesisEditFor`. Buying the pull that contradicts your opening call is
  // precisely when you should be able to say so, and until this changed it was
  // the moment you no longer could.
  const [boughtCount, setBoughtCount] = useState(data.purchaseCount);
  const canAmend = data.phase === "investigate";
  const [editing, setEditing] = useState(false);
  const picking = data.phase === "observe" || (editing && canAmend);

  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmDecide, setConfirmDecide] = useState(false);

  const remaining = Math.max(0, data.scenario.budget.analystDays - daysSpent);

  function onRevealed(drilldownId: string, revealed: SimPanel[], spent: number) {
    setPanels((prev) => [...prev, ...revealed]);
    setDaysSpent(spent);
    // Only drives the copy now — "Revise" once something has been bought,
    // "Change" before. It stopped gating the hypothesis when the window moved
    // to the Commit boundary.
    setBoughtCount((n) => n + 1);
    // Marking it owned is the whole update. There is no lock left to recompute:
    // a pull's prerequisites no longer decide whether it can be bought, so
    // buying one cannot open another.
    setDrilldowns((prev) =>
      prev.map((d) => (d.id === drilldownId ? { ...d, owned: true } : d)),
    );
  }

  function toggleSuspect(id: string) {
    setSuspects((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= simConfig.maxSuspects) {
        toast.error(`Name at most ${simConfig.maxSuspects} — hedging across everything predicts nothing`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function saveHypothesis() {
    startTransition(async () => {
      const result = await commitHypothesis(data.runId, suspects, note);
      setConfirmLock(false);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save that");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function stopInvestigating() {
    startTransition(async () => {
      const result = await openDecision(data.runId);
      if (!result.ok) {
        toast.error(result.error ?? "Not available yet");
        return;
      }
      router.refresh();
    });
  }

  const roots = data.scenario.causes.filter((c) => c.parentId === null);

  return (
    // The primer stays the full reference; this makes every term it defines
    // reachable from the word itself, for the whole run rather than only on
    // arrival. Wrapped at the top so the header's "Analyst-days" is covered too.
    <GlossaryProvider teaching={teaching}>
    <div className="min-h-screen">
      <SimHeader
        title={data.scenario.title}
        phase={data.phase}
        runId={data.runId}
        timeSpentSec={data.timeSpentSec}
        daysSpent={daysSpent}
        daysTotal={data.scenario.budget.analystDays}
        onOpenConcepts={teaching ? () => setPrimerOpen(true) : undefined}
      />

      {teaching && (
        <ConceptPrimer
          teaching={teaching}
          open={primerOpen}
          onOpenChange={setPrimerOpen}
          onStart={data.phase === "observe" ? () => setPrimerOpen(false) : undefined}
        />
      )}

      <main className="container py-6">
        {data.phase === "observe" && (
          <Card className="mb-6 border-primary/30 bg-primary/5 p-5">
            <h1 className="text-lg font-semibold">{data.scenario.company}</h1>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {data.scenario.situation}
            </p>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
            {/* Above the dashboard, not beside it: the point is to be read
                before the metrics, not discovered after them. */}
            {data.scenario.metricMap && (
              <MetricMap nodes={data.scenario.metricMap} highlight={data.scenario.metricMap.at(-1)?.id} />
            )}
            <div>
              <h2 className="mb-3 text-sm font-semibold">Analytics</h2>
              <SimDashboard panels={panels} />
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            {picking && (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-primary" />{" "}
                  {editing ? "Change your hypothesis" : "Where do you think it is?"}
                </h2>
                {/* Committing first is still the habit being built — the
                    difference is that the commitment is now revisable, which is
                    what a hypothesis is for. What keeps it honest is that each
                    pull is judged against what you believed when you bought it,
                    so renaming your suspect afterwards buys nothing. */}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {editing ? (
                    <>
                      Changing your mind on the evidence is the point of buying it. Your earlier
                      call stays on the record, and the pulls you already ran are judged against
                      what you believed when you ran them.
                    </>
                  ) : (
                    <>
                      Commit to at most {simConfig.maxSuspects} before you spend a single
                      analyst-day. You can revise this as the data comes in — what you can&apos;t
                      do is un-buy a pull.
                    </>
                  )}
                </p>

                {/* States what is registered instead of leaving it to be
                    inferred from a highlight, and makes it removable in one
                    click. A student who selects by mistake should not have to
                    work out how to undo it. */}
                <SelectionRow
                  selected={suspects.map((id) => ({
                    id,
                    label: data.scenario.causes.find((c) => c.id === id)?.label ?? id,
                  }))}
                  onRemove={toggleSuspect}
                  emptyHint="Nothing selected yet — pick one or two below."
                />

                <div className="mt-3 space-y-3">
                  {roots.map((root) => (
                    <div key={root.id}>
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {root.label}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {data.scenario.causes
                          .filter((c) => c.parentId === root.id)
                          .map((cause) => (
                            <button
                              key={cause.id}
                              type="button"
                              aria-pressed={suspects.includes(cause.id)}
                              onClick={() => toggleSuspect(cause.id)}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs transition-colors",
                                suspects.includes(cause.id)
                                  ? "border-primary bg-primary/10 font-medium"
                                  : "hover:bg-accent",
                              )}
                            >
                              {cause.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Textarea
                  placeholder="Why? One line is enough — what would you expect the data to show if you're right?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-3 min-h-[72px] text-sm"
                />

                <div className="mt-3 flex gap-2">
                  {editing && (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={pending}
                      onClick={() => {
                        setSuspects(data.hypothesis);
                        setNote(data.hypothesisNote ?? "");
                        setEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    disabled={suspects.length === 0 || pending}
                    onClick={() => (editing ? saveHypothesis() : setConfirmLock(true))}
                  >
                    {editing ? "Save" : "Lock it in and start investigating"}
                    {!editing && <ArrowRight />}
                  </Button>
                </div>
              </Card>
            )}

            {data.phase === "investigate" && !editing && (
              <>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">Your hypothesis</div>
                    {canAmend ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> {boughtCount > 0 ? "Revise" : "Change"}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock className="h-3 w-3" /> settled
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {data.hypothesis.map((id) => (
                      <Badge key={id} variant="secondary">
                        {data.scenario.causes.find((c) => c.id === id)?.label ?? id}
                      </Badge>
                    ))}
                  </div>
                  {data.hypothesisNote && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      &ldquo;{data.hypothesisNote}&rdquo;
                    </p>
                  )}
                  {/* The line a stuck candidate actually reads. It used to say
                      only what had happened ("locked when you ran your first
                      analysis") and never what to do about it — and there was
                      nothing to do. Now it says the thing that is true and
                      useful: the data is allowed to change your mind. */}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {boughtCount > 0
                      ? "If the data points somewhere else, revise it — that's what buying it was for."
                      : "You can still change this — nothing has been spent yet."}
                  </p>
                </Card>

                <DrilldownMarket
                  runId={data.runId}
                  drilldowns={drilldowns}
                  remaining={remaining}
                  onRevealed={onRevealed}
                />

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  // Only worth confirming when it costs something. With the
                  // budget spent, moving on forfeits nothing.
                  onClick={() => (remaining > 0 ? setConfirmDecide(true) : stopInvestigating())}
                >
                  I know enough — decide <ArrowRight />
                </Button>
              </>
            )}

            {data.phase === "commit" && (
              <CommitPanel
                runId={data.runId}
                scenario={data.scenario}
                diagnosis={data.diagnosis}
                periods={data.periods}
              />
            )}
          </aside>
        </div>

        {/* Confirmations, each naming what it actually costs rather than asking
            a generic "are you sure?" — a dialog that doesn't say the price is
            just a click to get past. */}
        <Dialog open={confirmLock} onOpenChange={setConfirmLock}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Start investigating?</DialogTitle>
            <DialogDescription>
              You&apos;re going with{" "}
              <strong>
                {suspects
                  .map((id) => data.scenario.causes.find((c) => c.id === id)?.label)
                  .filter(Boolean)
                  .join(" and ")}
              </strong>
              . Committing before you spend anything is the habit being built, but this is not
              your final answer — revise it as the data comes in, and name the cause properly at
              the decision. What you can&apos;t undo is the analyst-days.
            </DialogDescription>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmLock(false)} disabled={pending}>
                Keep thinking
              </Button>
              <Button onClick={saveHypothesis} disabled={pending}>
                Start investigating
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDecide} onOpenChange={setConfirmDecide}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Move to the decision?</DialogTitle>
            <DialogDescription>
              You still have{" "}
              <strong>
                {remaining} analyst-day{remaining === 1 ? "" : "s"}
              </strong>{" "}
              left. You can&apos;t buy any more data once you move on — the rest of the budget goes
              unspent.
            </DialogDescription>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setConfirmDecide(false)}
                disabled={pending}
              >
                Keep investigating
              </Button>
              <Button
                onClick={() => {
                  setConfirmDecide(false);
                  stopInvestigating();
                }}
                disabled={pending}
              >
                Move to the decision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
    </GlossaryProvider>
  );
}
