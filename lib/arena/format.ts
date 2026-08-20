/**
 * The arena's format.
 *
 * A `SimFormat` like the war room and the turnaround, and registered in
 * `lib/sim/formats/registry.ts` for the same reason they are: `weightedOverallFor`
 * takes a format, `SimResult.formatSlug` names one, and a rubric a run is graded
 * against has to be the rubric its format declares. Reusing the type rather than
 * inventing a parallel one is what lets the arena's five dimensions render
 * through the same report machinery as everything else.
 *
 * Its phases are not the war room's four. A match has a lobby that may or may
 * not fill, a run of quarters, and a debrief — and the lobby is a real phase
 * rather than a screen, because a multi match genuinely sits in it until
 * somebody starts.
 */

import { mandiRubric } from "@/lib/sim/configs/mandi";
import type { SimFormat } from "@/lib/sim/formats/types";

export const ARENA_PHASES = ["lobby", "round", "debrief"] as const;

export const arenaFormat: SimFormat = {
  slug: "arena",
  label: "Arena",
  tagline: "Eight quarters against three rivals who read what you did and answer back.",
  phases: [
    { id: "lobby", label: "Lobby", help: "Take a seat. Empty seats are played by the house." },
    { id: "round", label: "Quarters", help: "Price, spend, build, promise — then watch the market answer." },
    { id: "debrief", label: "Debrief", help: "Who won the city, and what your rivals were actually playing for." },
  ],
  rubric: mandiRubric,
};
