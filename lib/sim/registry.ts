/**
 * The authored scenarios.
 *
 * Content lives in code rather than the database — see the note in `./types.ts`
 * — so this registry is the single seam a DB-backed loader would replace if
 * authoring ever needs to happen without a deploy.
 *
 * A scenario is reachable in the library through a `Question` row whose
 * `externalId` matches its `slug` (see `prisma/seed-data.ts`). The row carries
 * the catalogue metadata — category, difficulty, interview level — and this
 * carries the exercise.
 */

import type { SimScenario } from "./types";
import { metricDropFoodDelivery } from "./scenarios/metric-drop-food-delivery";
import { adFunnelRoas } from "./scenarios/ad-funnel-roas";
import { abTestReadout } from "./scenarios/ab-test-readout";
import { subscriptionLtvCac } from "./scenarios/subscription-ltv-cac";
import { channelTradeSpend } from "./scenarios/channel-trade-spend";
import { pricingElasticity } from "./scenarios/pricing-elasticity";
import { marketSizingGtm } from "./scenarios/market-sizing-gtm";

// Easiest first: this is the order the library shows them in, and a beginner
// meeting the track for the first time should not land on the hardest one.
const ALL: SimScenario[] = [
  adFunnelRoas,
  abTestReadout,
  subscriptionLtvCac,
  channelTradeSpend,
  pricingElasticity,
  marketSizingGtm,
  metricDropFoodDelivery,
];

const BY_SLUG: Record<string, SimScenario> = Object.fromEntries(
  ALL.map((scenario) => [scenario.slug, scenario]),
);

export function listScenarios(): SimScenario[] {
  return ALL;
}

/**
 * Undefined for an unknown slug rather than throwing: a `SimRun` can outlive the
 * scenario it was played against, and a removed scenario should render as "no
 * longer available" rather than take out the page.
 */
export function getScenario(slug: string): SimScenario | undefined {
  return BY_SLUG[slug];
}

export function hasScenario(slug: string): boolean {
  return slug in BY_SLUG;
}

/** Slugs the seed expects to find a catalogue `Question` for. */
export function scenarioSlugs(): string[] {
  return ALL.map((s) => s.slug);
}
