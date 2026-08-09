/**
 * The config-driven simulators.
 *
 * Deliberately separate from `lib/sim/registry.ts` rather than merged into it.
 * A `SimScenario` is built from drivers, causes and interventions; a
 * `SimulatorConfig` is built from mechanisms, an agent and a settlement. Forcing
 * one type to cover both would put a dozen optional fields on the twelve
 * scenarios that predate it, and every one of them would have to be read as
 * "not applicable here". Two registries, one question each — `getScenario` for
 * the authored scenarios, this for the parameterised ones.
 *
 * The run page asks this one first and falls back.
 */

import type { SimulatorConfig } from "./types";
import { buybackConfig } from "./buyback";

const ALL: SimulatorConfig[] = [buybackConfig];

const BY_SLUG: Record<string, SimulatorConfig> = Object.fromEntries(
  ALL.map((config) => [config.slug, config]),
);

export function listSimulators(): SimulatorConfig[] {
  return ALL;
}

/**
 * Undefined for an unknown slug rather than throwing, matching `getScenario`: a
 * `SimRun` can outlive the simulator it was played on.
 */
export function getSimulatorConfig(slug: string): SimulatorConfig | undefined {
  return BY_SLUG[slug];
}

export function isSimulatorSlug(slug: string): boolean {
  return slug in BY_SLUG;
}

/** Slugs the seed expects a catalogue `Question` row for. */
export function simulatorSlugs(): string[] {
  return ALL.map((c) => c.slug);
}
