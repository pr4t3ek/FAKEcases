/**
 * The buyback contract — the first CONFIG-DRIVEN format.
 *
 * The war room and the turnaround both play authored `SimScenario` content: a
 * hand-written causal model, a cause tree, a fixed set of interventions. This
 * one plays a `SimulatorConfig` instead — mechanisms, an agent and a settlement,
 * all parameters — and everything it needs to run comes out of
 * `lib/sim/configs`.
 *
 * So the format is thin on purpose. Its rubric is read off the config rather
 * than declared here, because a second config-driven simulator (marketing, and
 * whatever follows) must be able to grade on its own dimensions without a new
 * format module. What this file actually contributes is the phase sequence and
 * the identity the catalogue and the run page dispatch on.
 */

import { buybackConfig } from "@/lib/sim/configs/buyback";
import type { SimFormat } from "./types";

export const BUYBACK_PHASES = ["brief", "month", "debrief"] as const;

export const buybackFormat: SimFormat = {
  slug: "buyback",
  label: "Contract simulator",
  tagline:
    "Twelve months of ordering against a buyback clause, from a supplier who is watching how you use it.",
  phases: [
    { id: "brief", label: "Brief", help: "The contract, the terms and what you are being judged on." },
    { id: "month", label: "Months", help: "Order, price, watch the month land, then decide again." },
    { id: "debrief", label: "Debrief", help: "Your year against five hundred others, and what was hidden." },
  ],
  // Read from the config, not restated. A second config-driven simulator grades
  // on its own dimensions through this same format seam.
  rubric: buybackConfig.rubric,
};
