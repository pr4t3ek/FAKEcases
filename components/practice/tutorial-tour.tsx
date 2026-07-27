"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, GraduationCap, X } from "lucide-react";
import { evaluationCategories, hintConfig, readinessBands } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A guided walkthrough of the practice screen, anchored to the real elements via
 * `data-tour` attributes. Each step says what the thing is AND how it moves the
 * score, so the rubric stops being a black box. The closing step renders the
 * weights straight from lib/config so it can never drift from the scorer.
 */

type Step = {
  /** `data-tour` value of the element to spotlight. Omitted = centred card. */
  target?: string;
  title: string;
  body: string;
  /** How this step affects the scorecard, if it does. */
  scoring?: string;
  /** Panel this step lives in — revealed first on the mobile tab layout. */
  panel?: "tools" | "chat" | "progress";
  /** Tools-panel tab this step lives in, revealed first. */
  tool?: "framework" | "notes";
  /** Rendered instead of body on the closing step. */
  rubric?: boolean;
};

const HINTS = hintConfig.levels;

const STEPS: Step[] = [
  {
    title: "How this screen works",
    body:
      "A quick tour of every panel and — more importantly — exactly how each one is marked. " +
      "Six of the eight scored categories are things you control directly from this screen.",
  },
  {
    target: "question",
    panel: "tools",
    title: "The question, and your timer",
    body:
      "Your prompt with its category, difficulty, and the interviewer style it mirrors. The timer " +
      "starts automatically and you can pause it whenever you like.",
    scoring: "Time is not scored at all — it's here for realism, not pressure.",
  },
  {
    target: "tools-tabs",
    panel: "tools",
    title: "Your two work surfaces",
    body:
      "Framework is where you build the estimate. Notes is a plain scratchpad saved only on this " +
      "device — never submitted, never read by the interviewer.",
    scoring: "Nothing you type in Notes is graded. Use it as freely as paper.",
  },
  {
    target: "framework",
    panel: "tools",
    tool: "framework",
    title: "The framework builder — the biggest lever",
    body:
      "Break the problem into steps. The first one you add is the starting step and every step " +
      "after it continues the chain underneath — use a row's + when you want to split that step " +
      "into segments instead. Each step's first box takes an absolute figure (1.3cr) or a share " +
      "of its parent (65%); the × box holds a rate, like 3 cups a day. Percentage branches under " +
      "Σ Sum are checked for adding to 100%, and the chain result can be pushed straight into " +
      "your final estimate.",
    scoring:
      "This drives the two heaviest categories — Problem Structuring (weight 1.4) and " +
      "Segmentation (1.3). Every step you add lifts them, up to five steps. The figures in the " +
      "boxes are also read as your assumptions, so there's no separate list to keep.",
  },
  {
    target: "calculator-btn",
    panel: "tools",
    title: "The calculator, wherever you want it",
    body:
      "Opens a calculator you can drag anywhere on screen, so it stays with you while you build " +
      "the framework. It understands k, L, cr and both × and x.",
    scoring: "Saving even one calculation adds 12 points to Logical Thinking.",
  },
  {
    target: "modes",
    panel: "chat",
    title: "Choose how much help you want",
    body:
      "Interviewer only asks questions. Coach nudges you. Teacher explains outright. Evaluator " +
      "grades as you go. Switch at any time.",
    scoring: "The mode itself is never scored — pick whatever helps you learn today.",
  },
  {
    target: "composer",
    panel: "chat",
    title: "Think aloud here",
    body:
      "Say your reasoning out loud as you would in a real interview. The interviewer responds to " +
      "what you write, and silence tells it nothing.",
    scoring:
      "Communication is scored from how much you actually articulate — each of your first six " +
      "messages adds to it. Assumption Quality is won here too: a figure you explain (“40% " +
      "urban, from the census”) outscores the same figure sitting unexplained in your tree.",
  },
  {
    target: "hint",
    panel: "chat",
    title: `${HINTS} escalating hints`,
    body:
      `Each hint reveals a little more, and none of them hands over the answer. After all ${HINTS}, ` +
      "the button switches you to Teacher mode for a full explanation.",
    scoring: `Every hint costs 12 points of Confidence — so spend them when you're genuinely stuck.`,
  },
  {
    target: "estimate",
    panel: "progress",
    title: "Your final estimate",
    body:
      "The number you're committing to. The framework's chain result can be dropped in with one " +
      "click, or type it yourself.",
    scoring:
      "This sets Calculation Accuracy: inside the ideal range scores highest, within 2× scores " +
      "partial credit, further out scores low. Leaving it blank costs you the most.",
  },
  {
    target: "submit",
    panel: "progress",
    title: "Submit when you're ready",
    body:
      "This closes the attempt and produces your scorecard, XP and rank movement. The model " +
      "answer and a better-approach note unlock only after you submit — so commit first.",
    scoring: "Nothing is graded until you press this.",
  },
  {
    rubric: true,
    title: "How your score is built",
    body:
      "Eight categories, each weighted, averaged into one score out of 100. Your rank is set by " +
      "your percentile against other candidates, not by raw points.",
  },
];

export function TutorialTour({
  onReveal,
}: {
  /** Asks the practice screen to reveal a panel / tool tab before measuring. */
  onReveal: (panel?: string, tool?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  // Read-only: never scrolls. Scrolling here would fire the scroll listener
  // below, which would measure again and scroll again — the highlight and card
  // would oscillate and never settle. Bailing out when the rect is unchanged
  // keeps the same loop from forming through re-renders.
  const measure = useCallback(() => {
    const el = step?.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null;
    const next = el?.getBoundingClientRect() ?? null;
    setRect((prev) => {
      if (!next) return null;
      if (
        prev &&
        Math.abs(prev.top - next.top) < 1 &&
        Math.abs(prev.left - next.left) < 1 &&
        Math.abs(prev.width - next.width) < 1 &&
        Math.abs(prev.height - next.height) < 1
      ) {
        return prev;
      }
      return next;
    });
  }, [step]);

  // Reveal the panel this step lives in (mobile puts them behind tabs), bring
  // the target into view once, then measure after it has mounted and settled.
  useLayoutEffect(() => {
    if (!open || !step) return;
    if (step.panel || step.tool) onReveal(step.panel, step.tool);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      if (step.target) {
        document
          .querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      raf2 = requestAnimationFrame(measure);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, step, measure, onReveal]);

  // Height depends only on the step's copy (width is fixed), so this settles in
  // one pass and can't oscillate with the position it feeds.
  useLayoutEffect(() => {
    if (!open) return;
    const h = cardRef.current?.offsetHeight ?? 0;
    if (h && Math.abs(h - cardH) > 1) setCardH(h);
  }, [open, i, rect, cardH]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function start() {
    setI(0);
    setOpen(true);
  }

  // Card sits below the highlight when it fits, otherwise above, and is clamped
  // into the viewport as a last resort. Its height is MEASURED rather than
  // assumed — a step with longer copy is tall enough to push its own buttons
  // off a phone screen.
  const CARD_W = 360;
  const GAP = 12;
  const cardStyle: React.CSSProperties = (() => {
    if (!rect) {
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: CARD_W };
    }
    const vh = window.innerHeight;
    const h = cardH || 280;
    let top = rect.bottom + GAP;
    if (top + h > vh - GAP) top = rect.top - h - GAP; // flip above
    if (top < GAP) top = Math.max(GAP, vh - h - GAP); // clamp into view
    const left = Math.min(
      Math.max(GAP, rect.left + rect.width / 2 - CARD_W / 2),
      Math.max(GAP, window.innerWidth - CARD_W - GAP),
    );
    return { left, top, width: CARD_W };
  })();

  return (
    <>
      <button
        onClick={start}
        data-tour="tutorial-btn"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <GraduationCap className="h-3.5 w-3.5" /> Tutorial
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Practice screen tutorial">
            {/* Dim everything, with a hole punched over the highlighted element. */}
            {rect ? (
              <div
                className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
                style={{
                  left: rect.left - 4,
                  top: rect.top - 4,
                  width: rect.width + 8,
                  height: rect.height + 8,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-black/62" />
            )}

            {/* Click-off layer, behind the card. */}
            <button
              aria-label="Close tutorial"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default"
            />

            <div
              ref={cardRef}
              style={cardStyle}
              className="absolute max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border bg-card p-4 shadow-2xl"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Step {i + 1} of {STEPS.length}
                  </div>
                  <h2 className="text-base font-semibold leading-snug">{step.title}</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close tutorial"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">{step.body}</p>

              {step.scoring && (
                <p className="mt-2 rounded-md border-l-2 border-primary bg-primary/5 px-2.5 py-2 text-xs text-foreground">
                  {step.scoring}
                </p>
              )}

              {step.rubric && (
                <div className="mt-3 space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-1 font-medium">Category</th>
                          <th className="pb-1 text-right font-medium">Weight</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {evaluationCategories.map((c) => (
                          <tr key={c.key} className="border-t">
                            <td className="py-1 pr-2">{c.label}</td>
                            <td className="py-1 text-right font-mono">{c.weight.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...readinessBands].reverse().map((b) => (
                      <span
                        key={b.band}
                        className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {b.band} {b.min > 0 ? `${b.min}+` : "<50"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex gap-1" aria-hidden>
                  {STEPS.map((_, n) => (
                    <span
                      key={n}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        n === i ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  {i > 0 && (
                    <Button variant="secondary" onClick={() => setI(i - 1)} className="h-7 px-2 text-xs">
                      <ArrowLeft className="mr-1 h-3 w-3" /> Back
                    </Button>
                  )}
                  <Button
                    onClick={() => (isLast ? setOpen(false) : setI(i + 1))}
                    className="h-7 px-2.5 text-xs"
                  >
                    {isLast ? "Got it" : "Next"}
                    {!isLast && <ArrowRight className="ml-1 h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
