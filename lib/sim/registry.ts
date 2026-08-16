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
import { vyaparMitraActivation } from "./scenarios/vyapar-mitra-activation";
import { subscriptionLtvCac } from "./scenarios/subscription-ltv-cac";
import { channelTradeSpend } from "./scenarios/channel-trade-spend";
import { pricingElasticity } from "./scenarios/pricing-elasticity";
import { marketSizingGtm } from "./scenarios/market-sizing-gtm";
import { marketplaceLiquidity } from "./scenarios/marketplace-liquidity";
import { b2bDealTco } from "./scenarios/b2b-deal-tco";
import { sehatPlusServiceLevel } from "./scenarios/sehat-plus-service-level";
import { pnlProfitSqueeze } from "./scenarios/pnl-profit-squeeze";
import { cashConversionCycle } from "./scenarios/cash-conversion-cycle";
import { balanceSheetLeverage } from "./scenarios/balance-sheet-leverage";
import { cashRunwayTurnaround } from "./scenarios/cash-runway-turnaround";

// Easiest first: this is the order the library shows them in, and a beginner
// meeting the track for the first time should not land on the hardest one.
//
// The three finance scenarios sit together rather than being interleaved by
// topic, because they are a sequence: the P&L one teaches a student to read a
// statement, the cash flow one shows them that statement cannot tell them
// whether the company can pay anybody, and the balance sheet one adds the
// capital neither of the first two can see. Kept contiguous, and still in
// difficulty order — Easy, Easy, Medium, ahead of the Medium block.
const ALL: SimScenario[] = [
  adFunnelRoas,
  abTestReadout,
  vyaparMitraActivation,
  subscriptionLtvCac,
  channelTradeSpend,
  pnlProfitSqueeze,
  cashConversionCycle,
  balanceSheetLeverage,
  pricingElasticity,
  marketSizingGtm,
  marketplaceLiquidity,
  sehatPlusServiceLevel,
  b2bDealTco,
  metricDropFoodDelivery,
  // Last: the only turnaround in the catalogue, and a different exercise from
  // everything above it. A student meeting the track should play at least one
  // war room before one that assumes the diagnosis is already done.
  cashRunwayTurnaround,
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
