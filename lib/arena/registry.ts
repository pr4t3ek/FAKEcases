/**
 * The games the arena can play.
 *
 * Its OWN registry rather than an entry in `lib/sim/configs/registry.ts`, and
 * the reason is not tidiness. That registry means "config-driven simulators
 * reachable from the war-room catalogue": everything in it is expected to have a
 * `Question` row whose `externalId` matches its slug (`simulatorSlugs`), is
 * startable through `startSimulation`, and is counted by
 * `tests/entitlements.test.ts` as part of the simulation library. An arena game
 * is none of those things — it has no catalogue row, it is reached from `/arena`
 * and it is gated per account rather than by tier. Adding it there would have
 * been one line and four wrong behaviours.
 */

import { mandiConfig } from "@/lib/sim/configs/mandi";
import type { SimulatorConfig } from "@/lib/sim/configs/types";

const ALL: SimulatorConfig[] = [mandiConfig];

const BY_SLUG: Record<string, SimulatorConfig> = Object.fromEntries(
  ALL.map((config) => [config.slug, config]),
);

/** The game a new match opens on when nobody says. */
export const DEFAULT_GAME_SLUG = mandiConfig.slug;

export function listArenaGames(): SimulatorConfig[] {
  return ALL;
}

/** Undefined for an unknown slug, matching every other registry in the repo. */
export function getArenaGame(slug: string): SimulatorConfig | undefined {
  return BY_SLUG[slug];
}

export function isArenaGame(slug: string): boolean {
  return slug in BY_SLUG;
}
