/**
 * The turnaround — the same business model, played as a sequence rather than a
 * single shot.
 *
 * The war room asks one question once: what is wrong, and what will you spend on
 * it? Everything the student decides is decided before they see any of it work.
 * That is a fair test of diagnosis and a poor test of judgement, because the
 * expensive mistakes in a real turnaround are made in the second quarter — after
 * the first fix half-lands, the numbers move less than the deck promised, and
 * the temptation is to abandon a change that was ramping correctly.
 *
 * So this format runs the same causal model four times, showing what each period
 * did before the next allocation is chosen. It exists because of what the driver
 * graph learned to do: a `stock` means capital actually depletes and cannot be
 * un-spent, and a `lagged` driver means this period's cut arrives as next
 * period's problem. Neither is expressible in a one-shot allocation, which is
 * why this could not have been the second format before those landed.
 *
 * What it deliberately does NOT have: a hypothesis phase or an investigation
 * budget. Diagnosis is the war room's exercise and repeating it here would make
 * this a war room with extra clicks. Here the cause is visible from the start and
 * the difficulty is entirely in sequencing and patience.
 */

import type { SimFormat } from "./types";

export const TURNAROUND_PHASES = ["brief", "period", "debrief"] as const;

/**
 * Four dimensions, none of them shared with the war room's five — which is the
 * whole reason `SimResult` grew `scoresJson`. Grading adaptation against
 * `hypothesis` and `investigation` columns would be a lie in the schema.
 *
 * Adaptation carries the most weight because it is the one thing this format can
 * measure that no other can. Patience is its counterweight and the trap: a
 * student who rewrites the plan every period scores well on neither, which is
 * exactly the behaviour a turnaround punishes.
 */
export const turnaroundRubric = [
  {
    key: "read",
    label: "Reading the period",
    hint: "Did you act on what the last period actually showed, or on what you expected?",
    weight: 1.2,
  },
  {
    key: "adaptation",
    label: "Adaptation",
    hint: "When the evidence moved, did the capacity move with it?",
    weight: 1.5,
  },
  {
    key: "patience",
    label: "Patience",
    hint: "Did you let a fix that was working finish, instead of cutting it mid-ramp?",
    weight: 1.2,
  },
  {
    key: "outcome",
    label: "Outcome",
    hint: "Where the business ended up, against what was achievable from here.",
    weight: 1.0,
  },
] as const;

export type TurnaroundRubricKey = (typeof turnaroundRubric)[number]["key"];

export const turnaroundFormat: SimFormat = {
  slug: "turnaround",
  label: "Turnaround",
  tagline: "Four periods. Allocate, watch it land, then decide again with what you learned.",
  phases: [
    { id: "brief", label: "Brief", help: "Where the business stands and how long it has." },
    { id: "period", label: "Quarters", help: "Allocate, run the quarter, then reallocate." },
    { id: "debrief", label: "Debrief", help: "The whole sequence, against the best path from here." },
  ],
  rubric: turnaroundRubric,
};
