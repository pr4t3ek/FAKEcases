import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The first-run sequence, tested as text.
 *
 * There is no DOM in this suite — `vitest.config.ts` runs in node and only
 * collects `.ts` — so the components themselves can't be rendered here. What
 * can still be checked is the wiring, and that is where this breaks quietly: a
 * first-timer is meant to get the welcome card, then the worked example if they
 * want it, and THEN the tour. Drop the callback that chains them and nothing
 * fails — the tour simply never opens for the one person it was written for.
 */
const overlay = readFileSync(
  resolve(__dirname, "../components/practice/onboarding-overlay.tsx"),
  "utf8",
);
const screen = readFileSync(
  resolve(__dirname, "../components/practice/practice-screen.tsx"),
  "utf8",
);

describe("the welcome card", () => {
  it("reports back on both ways out of the flow", () => {
    // Dismissed outright, and closed after watching the walkthrough. Missing
    // either one strands the tour behind a card that has already gone.
    expect(overlay).toContain("onFinished?.()");
    expect(overlay.match(/onFinished\?\.\(\)/g)?.length).toBe(2);
  });

  it("does not report finished while the walkthrough is still playing", () => {
    const watch = overlay.slice(overlay.indexOf("function watch()"));
    expect(watch.slice(0, watch.indexOf("}"))).not.toContain("onFinished");
  });
});

describe("the practice screen", () => {
  it("queues the tour for a first-timer instead of opening it on the card", () => {
    expect(screen).toContain("setTourQueued(true)");
    expect(screen).toContain("onFinished={startQueuedTour}");
  });

  it("still leaves a returning candidate's guesstimate untoured", () => {
    // The tour stays on the header button for them; only a case opens it
    // unprompted every attempt, because there it replaces the welcome card.
    expect(screen).toContain("if (!qualitative && !data.showOnboarding) return;");
  });
});
