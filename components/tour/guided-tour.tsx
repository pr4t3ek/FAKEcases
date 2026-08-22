"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { placeCard } from "@/lib/tour-placement";

/**
 * The machinery behind a guided tour, with none of the words.
 *
 * Two screens are toured now — the practice screen and the war room — and they
 * have nothing in common except this: a spotlight over a real element, a card
 * placed so it doesn't cover what it is pointing at, and a way out that is
 * remembered. Copying that into a second file is how the two would drift, and
 * the placement maths in particular has already been wrong once
 * (`lib/tour-placement.ts` exists because of it), so there is exactly one copy.
 *
 * What each tour supplies is its steps, and a `renderExtra` for the one step
 * that shows a rubric. Nothing here knows what is being taught.
 */

export interface TourStep {
  /** `data-tour` value of the element to spotlight. Omitted = centred card. */
  target?: string;
  title: string;
  body: string;
  /** How this step affects the scorecard, if it does. Rendered as a callout. */
  scoring?: string;
}

export function GuidedTour<S extends TourStep>({
  steps,
  ariaLabel,
  buttonLabel = "Tutorial",
  autoStart = false,
  onEnterStep,
  onExit,
  onSuppressChange,
  renderExtra,
}: {
  steps: S[];
  /** Names the dialog for a screen reader: "Practice screen tutorial". */
  ariaLabel: string;
  buttonLabel?: string;
  /** Open once on mount — the screen decides when that's warranted. */
  autoStart?: boolean;
  /**
   * Run before the step is measured: reveal the panel it lives in, draw an
   * illustration, whatever the screen needs doing to make the target real.
   * Deliberately one hook rather than several — every one of those jobs has to
   * happen before the element is measured, so they share a moment.
   */
  onEnterStep?: (step: S) => void;
  /** The tour closed, by any route — the ✕, Esc, Skip, the click-off layer. */
  onExit?: () => void;
  /** The reader ticked "don't show this automatically again". */
  onSuppressChange?: (suppressed: boolean) => void;
  /** Extra content under the body — the closing rubric table, typically. */
  renderExtra?: (step: S) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(0);
  const [suppress, setSuppress] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // A step list that shrinks under a running tour (the war room's does, when
  // the run changes phase) must not strand the reader past the end.
  const index = Math.min(i, Math.max(0, steps.length - 1));
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Once per mount. The screen has already decided this reader has never been
  // toured, so re-opening on a re-render would be a nuisance.
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    setI(0);
    setOpen(true);
  }, [autoStart]);

  // Memoised so the Esc listener below can depend on it honestly instead of
  // re-binding on every render.
  const close = useCallback(() => {
    setOpen(false);
    onExit?.();
    onSuppressChange?.(suppress);
  }, [onExit, onSuppressChange, suppress]);

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
      // A hidden element measures 0×0 at the origin, and a spotlight on that is
      // a dot in the corner of the screen pointing at nothing. The war room's
      // phase stepper and analyst-day meter are both `hidden` under a
      // breakpoint, so this is the phone case, not a hypothetical one — the
      // card centres instead, which is what a step with no target does anyway.
      if (!next || next.width === 0 || next.height === 0) return null;
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

  // Let the screen make the target real (reveal a panel, draw a demo), bring it
  // into view once, then measure after it has mounted and settled.
  useLayoutEffect(() => {
    if (!open || !step) return;
    onEnterStep?.(step);
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
  }, [open, step, measure, onEnterStep]);

  // Height depends only on the step's copy (width is fixed), so this settles in
  // one pass and can't oscillate with the position it feeds.
  useLayoutEffect(() => {
    if (!open) return;
    const h = cardRef.current?.offsetHeight ?? 0;
    if (h && Math.abs(h - cardH) > 1) setCardH(h);
  }, [open, index, rect, cardH]);

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
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, steps.length]);

  function start() {
    setI(0);
    setOpen(true);
  }

  // Below, above, beside, then clamped — the maths is in `lib/tour-placement.ts`
  // so the property that matters can be tested. It could not be before, and the
  // consequence was that the steps which draw a demo tree all pointed at an
  // element too tall to sit above or below, so the card was pinned to the
  // bottom of the viewport and landed across the tree it was explaining.
  //
  // Height is MEASURED rather than assumed — a step with longer copy is tall
  // enough to push its own buttons off a phone screen.
  const CARD_W = 360;
  const cardStyle: React.CSSProperties = (() => {
    if (!rect) {
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: CARD_W };
    }
    const { left, top } = placeCard({
      target: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      card: { width: CARD_W, height: cardH || 280 },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    return { left, top, width: CARD_W };
  })();

  if (!step) return null;

  return (
    <>
      {/* The label goes at phone width, the way the Concepts button next to it
          in the war room does — a header of five controls is otherwise wider
          than the screen. The accessible name stays either way. */}
      <button
        onClick={start}
        data-tour="tutorial-btn"
        aria-label={buttonLabel}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <GraduationCap className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={ariaLabel}>
            {/* Dim everything, with a hole punched over the highlighted element. */}
            {rect ? (
              <div
                className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
                style={{
                  left: rect.left - 4,
                  top: rect.top - 4,
                  width: rect.width + 8,
                  height: rect.height + 8,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.8)",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-black/80" />
            )}

            {/* Click-off layer, behind the card. */}
            <button
              aria-label="Close tutorial"
              tabIndex={-1}
              onClick={close}
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
                    Step {index + 1} of {steps.length}
                  </div>
                  <h2 className="text-base font-semibold leading-snug">{step.title}</h2>
                </div>
                <button
                  onClick={close}
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

              {renderExtra?.(step)}

              {/* Offered on every step, not just the last: someone who already
                  knows the screen should be able to turn this off at the point
                  they realise they don't need it. */}
              {onSuppressChange && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={suppress}
                    onChange={(e) => setSuppress(e.target.checked)}
                    className="h-3 w-3 accent-current"
                  />
                  Don&apos;t show this automatically again
                </label>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex gap-1" aria-hidden>
                  {steps.map((_, n) => (
                    <span
                      key={n}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        n === index ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  {!isLast && (
                    <Button variant="ghost" onClick={close} className="h-7 px-2 text-xs">
                      Skip
                    </Button>
                  )}
                  {index > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => setI(index - 1)}
                      className="h-7 px-2 text-xs"
                    >
                      <ArrowLeft className="mr-1 h-3 w-3" /> Back
                    </Button>
                  )}
                  <Button
                    onClick={() => (isLast ? close() : setI(index + 1))}
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
