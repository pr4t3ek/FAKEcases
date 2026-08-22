import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SIM_PHASES } from "@/lib/types";
import { warRoomFormat } from "@/lib/sim/formats/war-room";

/**
 * The war room's tutorial, tested as wiring rather than as pixels.
 *
 * There is no DOM in this suite — `vitest.config.ts` runs in node and only
 * collects `.ts` — so the tour can't be rendered here. What can be checked is
 * the thing that breaks silently: every step points at a `data-tour` anchor by
 * string, and renaming one on the screen leaves a tour that still opens, still
 * advances, and spotlights nothing. Nothing else in the suite would notice.
 */

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

const tour = read("components/simulation/war-room-tour.tsx");
const screen = read("components/simulation/simulation-screen.tsx");
const header = read("components/simulation/sim-header.tsx");
const shell = read("components/tour/guided-tour.tsx");

/** Every `target: "…"` the tour names, in order. */
const targets = [...tour.matchAll(/target:\s*"([^"]+)"/g)].map((m) => m[1]);
/** Every `data-tour="…"` the run's own components carry. */
const anchors = new Set(
  [...(screen + header).matchAll(/data-tour="([^"{]+)"/g)].map((m) => m[1]),
);

describe("the tour's anchors", () => {
  it("names at least the six pieces of the screen worth explaining", () => {
    expect(targets.length).toBeGreaterThanOrEqual(6);
  });

  it("points only at elements that actually exist", () => {
    for (const target of targets) {
      expect(anchors, `no data-tour="${target}" on the war room screen`).toContain(target);
    }
  });

  it("covers the run from the free board through to the commit", () => {
    for (const anchor of ["sim-phases", "sim-days", "sim-dashboard", "sim-hypothesis", "sim-pulls", "sim-commit"]) {
      expect(targets).toContain(anchor);
    }
  });
});

describe("what the tour teaches", () => {
  it("walks the whole run, not just the phase the reader is in", () => {
    // A step outside the current phase keeps its words and loses its pointer.
    expect(tour).toContain("{ ...step, target: undefined }");
    for (const phase of SIM_PHASES.filter((p) => p !== "debrief")) {
      expect(tour).toMatch(new RegExp(`phase: "${phase}"`));
    }
  });

  it("reads the rubric off the format rather than restating it", () => {
    // The five dimensions and their weights are `lib/sim/formats/war-room.ts`.
    // A literal table here would be correct exactly until someone retunes a
    // weight, and wrong silently afterwards.
    expect(tour).toContain("warRoomFormat");
    expect(tour).toContain("dim.weight.toFixed(1)");
    for (const dim of warRoomFormat.rubric) {
      expect(tour).not.toContain(`"${dim.label}"`);
    }
  });

  it("quotes the prices from config, not from memory", () => {
    for (const key of [
      "simConfig.maxSuspects",
      "simConfig.shotgunPenalty",
      "simConfig.overspendOverallPenalty",
      "simConfig.maxCausesNamed",
      "simConfig.stalledDecisionPenalty",
    ]) {
      expect(tour).toContain(key);
    }
  });

  it("does not point at a map or a primer the scenario withheld", () => {
    // A hard scenario ships no metric map, and not every scenario carries
    // teaching — a step spotlighting either would be spotlighting nothing.
    expect(tour).toContain('step.target !== "sim-metric-map" || hasMetricMap');
    expect(tour).toContain('step.target !== "sim-concepts" || hasConcepts');
  });
});

describe("when it opens", () => {
  it("waits for the concept primer instead of opening on top of it", () => {
    expect(screen).toContain("setTourQueued(true)");
    expect(screen).toContain("startQueuedTour()");
    // Both ways out of the dialog report it closed, or the tour stays queued
    // behind a card that has already gone.
    expect(screen).toContain("onStart={data.phase === \"observe\" ? closePrimer : undefined}");
    expect(screen).toContain("open ? setPrimerOpen(true) : closePrimer()");
  });

  it("opens once per run, and can be switched off for good", () => {
    expect(screen).toContain("`sim-tour-seen-${data.runId}`");
    expect(screen).toContain('const TOUR_OFF = "sim-tour-off"');
    // localStorage throws rather than returning null in a private window, and
    // a tutorial preference is not worth taking a run down for.
    expect(screen).toMatch(/try \{[\s\S]*localStorage\.getItem\(TOUR_OFF\)[\s\S]*\} catch/);
  });
});

describe("the shared shell", () => {
  it("is shared, so the two tours cannot drift apart", () => {
    expect(tour).toContain('from "@/components/tour/guided-tour"');
    expect(read("components/practice/tutorial-tour.tsx")).toContain(
      'from "@/components/tour/guided-tour"',
    );
  });

  it("centres its card rather than spotlighting a hidden element", () => {
    // The phase stepper and the analyst-day meter are both hidden under a
    // breakpoint, where `getBoundingClientRect` reports 0×0 at the origin.
    expect(shell).toContain("next.width === 0 || next.height === 0");
  });
});
