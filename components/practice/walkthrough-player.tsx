"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, X } from "lucide-react";

import { rollup } from "@/lib/framework-rollup";
import { layoutTree, CARD_WIDTH } from "@/lib/framework-layout";
import { resultForms } from "@/lib/calc";
import { toNodes } from "@/lib/walkthrough/validate";
import type { WalkthroughContent } from "@/lib/walkthrough/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A worked guesstimate, played one step at a time.
 *
 * ## Why this is not the real canvas
 *
 * `TutorialTour` paints its illustrations onto the live `FrameworkCanvas` with
 * a `demo:` id prefix, which works because that tour is ABOUT the screen it is
 * standing on. This is not: the example is a different question from the one
 * behind it, and a chai tree laid over an umbrella prompt reads as a bug.
 *
 * It also removes a whole class of risk. `FrameworkCanvas` takes a dozen
 * mutation handlers and the builder debounce-saves its `nodes` array wholesale,
 * so an example that reached it would be persisted and then scored. A renderer
 * with no write path cannot do that — not because it is careful, but because
 * there is nothing to call.
 *
 * Layout and arithmetic are still the real ones (`layoutTree`, `rollup`), so
 * the tree a student watches is positioned and computed exactly like the tree
 * they are about to build.
 */

const CARD_HEIGHT = 96;
const AUTOPLAY_MS = 4200;

export interface WalkthroughPlayerProps {
  title: string;
  prompt: string;
  unit: string | null;
  content: WalkthroughContent;
  onClose: () => void;
}

export function WalkthroughPlayer({
  title,
  prompt,
  unit,
  content,
  onClose,
}: WalkthroughPlayerProps) {
  // -1 is the intro; `steps.length` is the closing total. So the player has two
  // more positions than it has steps, and both are real screens rather than a
  // step wearing a different hat.
  const [at, setAt] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const last = content.steps.length;
  const allNodes = useMemo(() => toNodes(content.steps), [content.steps]);

  /** Only what has been revealed so far. */
  const shown = useMemo(
    () => allNodes.slice(0, Math.max(0, Math.min(at + 1, last))),
    [allNodes, at, last],
  );

  const layout = useMemo(
    () => layoutTree(shown, { cardWidth: CARD_WIDTH, heightOf: () => CARD_HEIGHT }),
    [shown],
  );

  const totals = useMemo(() => rollup(allNodes), [allNodes]);
  const grandTotal = useMemo(
    () => totals.roots.reduce((a, b) => a + b, 0),
    [totals],
  );

  const next = useCallback(() => setAt((n) => Math.min(last, n + 1)), [last]);
  const back = useCallback(() => {
    setPlaying(false);
    setAt((n) => Math.max(-1, n - 1));
  }, []);

  // Autoplay stops at the end rather than looping: a walkthrough that started
  // again from the top would look like it had not finished.
  useEffect(() => {
    if (!playing || at >= last) return;
    const t = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, at, last, next]);

  useEffect(() => {
    if (at >= last) setPlaying(false);
  }, [at, last]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  const step = at >= 0 && at < last ? content.steps[at] : null;
  const finished = at >= last;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Worked example"
    >
      <header className="flex items-start justify-between gap-4 border-b px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Worked example — not your question
          </p>
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{prompt}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close worked example">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-6 lg:flex-row">
        {/* The tree, growing a step at a time. */}
        <div className="flex min-h-[240px] flex-1 items-start justify-center overflow-auto rounded-lg border bg-muted/20 p-6">
          {shown.length === 0 ? (
            <p className="self-center text-sm text-muted-foreground">
              The tree starts on the next step.
            </p>
          ) : (
            <svg
              width={Math.max(layout.width, 120)}
              height={Math.max(layout.height, 120)}
              className="overflow-visible"
            >
              {layout.edges.map((e) => {
                const from = layout.nodes.get(e.from);
                const to = layout.nodes.get(e.to);
                if (!from || !to) return null;
                const y1 = from.y + CARD_HEIGHT;
                const mid = (y1 + to.y) / 2;
                return (
                  <path
                    key={`${e.from}-${e.to}`}
                    d={`M ${from.x} ${y1} V ${mid} H ${to.x} V ${to.y}`}
                    className="stroke-border"
                    strokeWidth={1.5}
                    fill="none"
                  />
                );
              })}
              {shown.map((n, i) => {
                const pos = layout.nodes.get(n.id);
                if (!pos) return null;
                const value = totals.resolved.get(n.id);
                const isNewest = i === shown.length - 1 && !finished;
                return (
                  <foreignObject
                    key={n.id}
                    x={pos.x - CARD_WIDTH / 2}
                    y={pos.y}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                  >
                    <div
                      className={cn(
                        "flex h-full flex-col justify-center rounded-md border bg-card px-3 py-2 shadow-sm transition-all",
                        isNewest && "border-primary ring-2 ring-primary/30",
                      )}
                    >
                      <p className="truncate text-sm font-medium">{n.label}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        {n.value ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                            {n.value}
                          </span>
                        ) : null}
                        {n.multiplier ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                            × {n.multiplier}
                          </span>
                        ) : null}
                      </div>
                      {value !== undefined ? (
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          = {resultForms(value).short ?? resultForms(value).exact}
                        </p>
                      ) : null}
                    </div>
                  </foreignObject>
                );
              })}
            </svg>
          )}
        </div>

        {/* What the narrator is saying about it. */}
        <aside className="flex w-full flex-col justify-between gap-4 lg:w-[22rem]">
          <div className="rounded-lg border p-4">
            {at < 0 ? (
              <p className="text-sm leading-relaxed">{content.intro}</p>
            ) : finished ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    The chain comes to
                  </p>
                  <p className="font-mono text-2xl font-semibold">
                    {resultForms(grandTotal).short ?? resultForms(grandTotal).exact}
                    {unit ? <span className="ml-1 text-sm font-normal">{unit}</span> : null}
                  </p>
                </div>
                <p className="text-sm leading-relaxed">{content.outro}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{step?.say}</p>
                <div className="rounded-md bg-muted/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Why that number
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{step?.because}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden>
                {Array.from({ length: last + 1 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= at ? "bg-primary" : "bg-border",
                    )}
                  />
                ))}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.max(0, Math.min(at + 1, last))}/{last}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={back} disabled={at < 0}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>

              {!finished ? (
                <>
                  <Button size="sm" className="flex-1" onClick={next}>
                    Next
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause" : "Play automatically"}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </>
              ) : (
                <Button size="sm" className="flex-1" onClick={onClose}>
                  Now try yours
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>

            {!finished ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Skip — take me to my question
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
