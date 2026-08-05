"use client";

import { BookOpen, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SimTeaching } from "@/lib/sim/types";

/**
 * The vocabulary, before it is needed.
 *
 * Shown on arrival and reopenable from the header for the rest of the run — a
 * student who meets "ROAS" three screens in has to be able to get back to what
 * it means without losing their place, and a definition they cannot find again
 * is a definition they did not read.
 *
 * Plain English comes before the formula on every term, deliberately. Someone
 * who does not yet know what ROAS is gets nothing from "revenue ÷ ad spend";
 * they need to be told it measures how many rupees came back per rupee spent,
 * and only then does the formula mean anything.
 */
export function ConceptPrimer({
  teaching,
  open,
  onOpenChange,
  onStart,
}: {
  teaching: SimTeaching;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only passed on the first showing, where the button starts the run. */
  onStart?: () => void;
}) {
  const { primer } = teaching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" /> Before you start
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          {primer.intro}
        </DialogDescription>

        <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
          {primer.terms.map((t) => (
            <div key={t.term} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{t.term}</span>
                {t.full && <span className="text-xs text-muted-foreground">{t.full}</span>}
              </div>
              <p className="mt-1 text-sm">{t.plain}</p>
              {t.formula && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  <Calculator className="h-3 w-3 text-muted-foreground" />
                  {t.formula}
                </div>
              )}
              {/* A definition nobody can act on is trivia, so every term says
                  what decision it changes. */}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Why it matters: </span>
                {t.matters}
              </p>
            </div>
          ))}

          {primer.worked && primer.worked.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Calculator className="h-4 w-4 text-primary" /> The numbers you&apos;re starting from
              </div>
              <ol className="space-y-1.5">
                {primer.worked.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                      {i + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <DialogFooter>
          {teaching.showMetricMap && (
            <span className="mr-auto hidden items-center text-xs text-muted-foreground sm:flex">
              The metric map on the run screen shows all of this with live numbers.
            </span>
          )}
          <Button onClick={() => (onStart ? onStart() : onOpenChange(false))}>
            {onStart ? "Got it — show me the dashboard" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The header button that brings the primer back mid-run. */
export function ConceptsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} className="gap-1.5">
      <BookOpen className="h-4 w-4" />
      <span className="hidden sm:inline">Concepts</span>
    </Button>
  );
}

/** A compact reminder of the terms, for the debrief. */
export function PrimerRecap({ teaching }: { teaching: SimTeaching }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {teaching.primer.terms.map((t) => (
        <Badge key={t.term} variant="muted" title={t.plain}>
          {t.term}
        </Badge>
      ))}
    </div>
  );
}
