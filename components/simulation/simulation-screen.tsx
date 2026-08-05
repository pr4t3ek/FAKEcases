"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { commitHypothesis, openDecision } from "@/app/actions/simulations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { simConfig } from "@/lib/config/simulation";
import { cn } from "@/lib/utils";
import type { SimPanel } from "@/lib/sim/types";
import { CommitPanel } from "./commit-panel";
import { ConceptPrimer } from "./concept-primer";
import { DrilldownMarket } from "./drilldown-market";
import { MetricMap } from "./metric-map";
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

  const remaining = Math.max(0, data.scenario.budget.analystDays - daysSpent);

  function onRevealed(drilldownId: string, revealed: SimPanel[], spent: number) {
    setPanels((prev) => [...prev, ...revealed]);
    setDaysSpent(spent);
    setDrilldowns((prev) =>
      prev.map((d) => ({
        ...d,
        owned: d.id === drilldownId ? true : d.owned,
        // A pull can unlock others, so recompute what is open.
        unlocked:
          d.unlocked ||
          (d.dependsOn ?? []).every((dep) =>
            dep === drilldownId ? true : prev.find((x) => x.id === dep)?.owned,
          ),
      })),
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

  function lockHypothesis() {
    startTransition(async () => {
      const result = await commitHypothesis(data.runId, suspects, note);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save that");
        return;
      }
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
    <div className="min-h-screen">
      <SimHeader
        title={data.scenario.title}
        phase={data.phase}
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
            {data.phase === "observe" && (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-primary" /> Where do you think it is?
                </h2>
                {/* Before any data is bought, deliberately. A hypothesis formed
                    after the evidence is not a hypothesis, and this is the
                    habit interviewers are actually listening for. */}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Commit to at most {simConfig.maxSuspects} before you spend a single analyst-day.
                  You can&apos;t change this once you start pulling data — that&apos;s the point.
                </p>

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

                <Button
                  className="mt-3 w-full"
                  disabled={suspects.length === 0 || pending}
                  onClick={lockHypothesis}
                >
                  Lock it in and start investigating <ArrowRight />
                </Button>
              </Card>
            )}

            {data.phase === "investigate" && (
              <>
                <Card className="p-4">
                  <div className="text-xs font-medium text-muted-foreground">Your hypothesis</div>
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
                  onClick={stopInvestigating}
                >
                  I know enough — decide <ArrowRight />
                </Button>
              </>
            )}

            {data.phase === "commit" && <CommitPanel runId={data.runId} scenario={data.scenario} />}
          </aside>
        </div>
      </main>
    </div>
  );
}
