/**
 * How money becomes effect.
 *
 * The v1 engine multiplied an effect by the funding ratio and clamped at 1, so
 * an effect was **linear in the money committed**. That single line is why
 * "fund everything permitted to exactly its ask until the budget is gone" was a
 * dominant strategy: every extra rupee weakly improved every ratio, spending was
 * never itself a cost, and the authored ceiling was by construction a max-spend
 * allocation. There was no reason to stop, so stopping was never a decision.
 *
 * A response curve is what turns spend into a decision. It answers two questions
 * an author needs to be able to answer separately:
 *
 *   - **How high can this ever go?** (`ceiling`) — the fraction of the authored
 *     `deltaPct` that infinite money would buy.
 *   - **How fast does it get there?** (`halfAt`) — the ask multiple at which half
 *     the ceiling has arrived.
 *
 * Both are expressed in **ask multiples** (`u = rupees ÷ cost.rupees`), so
 * `halfAt: 0.2` reads as "half of everything this can do arrives at a fifth of
 * what it asked for" without the author having to think in rupees.
 *
 * ## Why these three shapes
 *
 * `exponential` reaches 95% of its ceiling at `4.32 × halfAt` — there is a real
 * point past which nothing further happens. That is the honest shape for a lever
 * aimed at something that is not the problem: a brand campaign when conversion
 * is broken buys its small bump almost immediately and then buys nothing, no
 * matter how much is poured in.
 *
 * `hill` (Michaelis–Menten) reaches 95% only at `19 × halfAt` — there is always
 * a little more, just less and less of it. That is the shape of a lever that is
 * actually working.
 *
 * `proportional` is uncapped and linear, and it exists so the **cost** side of
 * an intervention can keep rising while its benefit flattens. That combination
 * is what gives a margin-shaped north star a genuine interior maximum, in the
 * model rather than in the scorer: discount deeper and the orders stop coming
 * while the discount keeps being paid.
 *
 * ## What is deliberately not offered
 *
 * A Hill curve with an exponent above 1 is S-shaped — convex near zero, so the
 * first rupees buy almost nothing. It is a realistic shape for a threshold
 * effect, and it is refused here anyway: convexity near the origin means the
 * optimiser cannot trust a local improvement, and `minSprints` already models a
 * threshold in a way a student can see coming. Thresholds are a cliff you are
 * told about, not a curve you discover.
 */

import { clamp } from "@/lib/utils";
import type { SimEffect, SimIntervention, SimResponse } from "./types";

/**
 * The response at ask multiple `u`.
 *
 * `u` is never negative (money is `z.number().min(0)` at the trust boundary),
 * but the clamp costs nothing and keeps the curves total.
 */
export function evalResponse(curve: SimResponse, u: number): number {
  const x = Math.max(0, u);
  switch (curve.kind) {
    // The v1 expression, written down rather than special-cased. A v2 scenario
    // whose effects all say `linear` must project identically to its v1 twin,
    // and `tests/sim-response.test.ts` pins exactly that.
    case "linear":
      return clamp(x, 0, 1);
    case "proportional":
      return (curve.slope ?? 1) * x;
    case "exponential":
      return curve.ceiling * (1 - Math.pow(2, -x / curve.halfAt));
    case "hill":
      return (curve.ceiling * x) / (curve.halfAt + x);
  }
}

/**
 * The slope at `u` — how much one more ask-multiple of money is worth here.
 *
 * Used by the optimiser's water-filling step and by the UI's "the next ₹50 L
 * buys about a tenth as much as the first" readout. The readout is safe to ship
 * to the browser because it is a **ratio** of two slopes on the same curve, and
 * a ratio cancels `deltaPct` — the student learns the shape of the lever without
 * learning its size, which is the thing the redaction layer protects.
 */
export function marginalResponse(curve: SimResponse, u: number): number {
  const x = Math.max(0, u);
  switch (curve.kind) {
    case "linear":
      return x >= 1 ? 0 : 1;
    case "proportional":
      return curve.slope ?? 1;
    case "exponential":
      return ((curve.ceiling * Math.LN2) / curve.halfAt) * Math.pow(2, -x / curve.halfAt);
    case "hill":
      return (curve.ceiling * curve.halfAt) / Math.pow(curve.halfAt + x, 2);
  }
}

/**
 * The ask multiple at which `frac` of the ceiling has arrived — the point past
 * which more money is, to any honest reading, waste.
 *
 * Null when the curve has no such point: `proportional` never satiates, and
 * `linear` satiates exactly at its ask, which the budget already handles. A null
 * contributes nothing to the waste term in `scoreDecision`, which is the
 * conservative direction — we charge a student for waste we can prove, not for
 * waste we inferred.
 */
export function satiationMultiple(curve: SimResponse, frac = 0.95): number | null {
  const f = clamp(frac, 0, 0.999);
  switch (curve.kind) {
    case "linear":
    case "proportional":
      return null;
    case "exponential":
      return (-curve.halfAt * Math.log2(1 - f)) as number;
    case "hill":
      return (curve.halfAt * f) / (1 - f);
  }
}

/**
 * Which curve governs this effect.
 *
 * Three levels, narrowest first: the effect's own curve, then the
 * intervention's default for this arm, then the engine default for the arm.
 * The arm — on target or not — is the level that matters, because "an
 * intervention aimed at the wrong cause saturates early and low" is a statement
 * about relevance rather than about any particular fix, and authoring it once
 * per scenario would be thirteen chances to forget.
 */
export function responseFor(
  iv: SimIntervention,
  effect: SimEffect,
  onTarget: boolean,
  defaults: { onTarget: SimResponse; offTarget: SimResponse },
): SimResponse {
  if (effect.saturation) return effect.saturation;
  const arm = onTarget ? iv.saturation?.whenRootCause : iv.saturation?.otherwise;
  if (arm) return arm;
  return onTarget ? defaults.onTarget : defaults.offTarget;
}
