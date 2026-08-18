"use client";

import { Beaker, Clock } from "lucide-react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SIM_PHASES, type SimPhase } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConceptsButton } from "./concept-primer";
import { GlossaryTerm } from "./glossary-term";

const PHASE_LABELS: Record<SimPhase, string> = {
  observe: "Observe",
  investigate: "Investigate",
  commit: "Decide",
  debrief: "Debrief",
};

/**
 * The run's chrome: where you are, and what you have left to spend.
 *
 * The analyst-day meter is the only pressure in the simulation — there is
 * deliberately no clock, because the scarce resource here is information, not
 * time, and a countdown would push candidates to buy fast rather than think
 * first.
 */
export function SimHeader({
  title,
  phase,
  daysSpent,
  daysTotal,
  onOpenConcepts,
}: {
  title: string;
  phase: SimPhase;
  daysSpent: number;
  daysTotal: number;
  /** Present only when the scenario carries a primer. */
  onOpenConcepts?: () => void;
}) {
  const remaining = Math.max(0, daysTotal - daysSpent);
  const currentIndex = SIM_PHASES.indexOf(phase);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center gap-4">
        {/* Brand renders its own link and takes an href for it — wrapping it in
            another one nests an <a> inside an <a>, which React reports as a
            hydration error. */}
        <Brand href="/library" className="shrink-0" />

        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          <Beaker className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Simulation phase">
          {SIM_PHASES.map((p, i) => (
            <span
              key={p}
              aria-current={p === phase ? "step" : undefined}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                i === currentIndex && "bg-primary/15 text-primary",
                i < currentIndex && "text-muted-foreground",
                i > currentIndex && "text-muted-foreground/50",
              )}
            >
              {i + 1}. {PHASE_LABELS[p]}
            </span>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {/* Always reachable, not just on arrival: a definition you cannot
              find again is a definition you did not read. */}
          {onOpenConcepts && <ConceptsButton onClick={onOpenConcepts} />}
          {phase !== "debrief" && (
            <div className="hidden w-40 sm:block">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  {/* A coined unit, and until now defined nowhere in the UI.
                      Scenarios that don't author it fall through to plain text. */}
                  <Clock className="h-3 w-3" />{" "}
                  <GlossaryTerm>Analyst-days</GlossaryTerm>
                </span>
                <span className="tabular-nums">
                  {remaining}/{daysTotal}
                </span>
              </div>
              <Progress
                value={(remaining / Math.max(1, daysTotal)) * 100}
                indicatorClassName={cn(
                  remaining === 0 && "bg-destructive",
                  remaining > 0 && remaining <= daysTotal * 0.25 && "bg-warning",
                )}
              />
            </div>
          )}
          <Badge variant="muted" className="sm:hidden">
            {remaining}d
          </Badge>
          </div>
      </div>
    </header>
  );
}
