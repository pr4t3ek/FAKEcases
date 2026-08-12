/**
 * The formats a scenario can be played on.
 *
 * Mirrors `lib/sim/registry.ts` — same shape, same posture, and the same reason
 * for existing: one place that knows the whole set, so adding to it is a single
 * edit rather than a search.
 */

import type { SimScenario } from "../types";
import type { SimFormat } from "./types";
import { warRoomFormat, periodicWarRoomFormat } from "./war-room";
import { turnaroundFormat } from "./turnaround";
import { buybackFormat } from "./buyback";

/**
 * The format a scenario runs on when it does not say.
 *
 * Defaulting rather than requiring `format` on every scenario is deliberate:
 * twelve existing files describe war rooms and making the field mandatory would
 * mean twelve edits that say nothing a default cannot. The point of putting the
 * format in one place is to stop changes rippling across the content.
 */
export const DEFAULT_FORMAT_SLUG = warRoomFormat.slug;

const ALL: SimFormat[] = [warRoomFormat, turnaroundFormat, buybackFormat];

const BY_SLUG: Record<string, SimFormat> = Object.fromEntries(
  ALL.map((format) => [format.slug, format]),
);

export function listFormats(): SimFormat[] {
  return ALL;
}

/**
 * Undefined for an unknown slug rather than throwing, matching `getScenario`: a
 * `SimRun` can outlive the format it was played on, and a removed format should
 * render as "no longer available" rather than take out the page.
 */
export function getFormat(slug: string): SimFormat | undefined {
  return BY_SLUG[slug];
}

/** The format a scenario runs on. Falls back to the war room. */
export function formatFor(
  scenario: Pick<SimScenario, "format" | "decisionPeriods">,
): SimFormat {
  // A war room that commits more than once is graded on a sixth dimension, and
  // the rubric a run is scored against has to be the one its format declares —
  // so the periodic variant is resolved from the scenario rather than switched
  // on inside the scorer.
  if (!scenario.format && (scenario.decisionPeriods ?? 1) > 1) return periodicWarRoomFormat;
  return getFormat(scenario.format ?? DEFAULT_FORMAT_SLUG) ?? warRoomFormat;
}

export function isTurnaround(scenario: Pick<SimScenario, "format">): boolean {
  return formatFor(scenario).slug === turnaroundFormat.slug;
}

/** The format a config-driven simulator plays on. */
export function formatForSimulator(): SimFormat {
  return buybackFormat;
}
