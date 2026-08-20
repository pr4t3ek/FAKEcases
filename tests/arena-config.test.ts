import { describe, expect, it } from "vitest";
import { cholesky } from "@/lib/sim/engine/stochastic";
import { duplicateOfferKeys } from "@/lib/sim/engine/agent";
import {
  FIRM_INDICES,
  firmKey,
  kpisForSeat,
  mandiConfig,
  mandiRubric,
  shockCovariance,
} from "@/lib/sim/configs/mandi";
import { PERSONAS, agentFor, dealPersonas } from "@/lib/arena/personas";
import { arenaFormat } from "@/lib/arena/format";
import { getFormat } from "@/lib/sim/formats/registry";

/**
 * The invariants a config can violate silently.
 *
 * Each of these has already been broken once during authoring, which is the
 * argument for pinning them: none announced itself, and every one of them
 * produced a plausible-looking game that was wrong.
 */
describe("mandi config", () => {
  it("gives every mechanism a shock, and every shock a mechanism", () => {
    // `runTick` hands mechanism `i` the `i`-th correlated shock, positionally.
    // A mismatch does not throw — it silently gives the market's noise to a
    // belief update and leaves a demand curve unshocked.
    const cov = shockCovariance();
    expect(cov).toHaveLength(mandiConfig.mechanisms.length);
    expect(cov.every((row) => row.length === cov.length)).toBe(true);
  });

  it("has a covariance matrix that can actually be factorised", () => {
    // `cholesky` throws on a matrix that is not positive definite, and it would
    // throw inside the first tick of a live match rather than here.
    expect(() => cholesky(mandiConfig.shockCovariance)).not.toThrow();
  });

  it("opens every key the model will ever read", () => {
    // The bug this exists for: `openState` builds history from the keys of
    // `initialState`, so a derived key missing here is computed every quarter,
    // visible in `current`, and has no history at all — which silently valued
    // eight quarters of trading at nil.
    const produced = [
      ...mandiConfig.mechanisms.map((m) => m.writes),
      ...mandiConfig.derivations.map((d) => d.writes),
    ];
    for (const key of produced) {
      expect(mandiConfig.initialState, `${key} missing from initialState`).toHaveProperty(key);
    }
  });

  it("opens the two keys that are read before they are written", () => {
    // Both were zero once, and both produced a wrong first quarter rather than
    // an error: no AI seat built capacity, and a best-response price came out
    // at ₹12.
    for (const seat of FIRM_INDICES) {
      expect(mandiConfig.initialState[firmKey(seat, "rawDemand")]).toBeGreaterThan(0);
      expect(mandiConfig.initialState[firmKey(seat, "unitCost")]).toBeGreaterThan(0);
    }
  });

  it("gives each rival its own offer keys", () => {
    // Two agents writing the same key means one of them silently loses.
    expect(duplicateOfferKeys(mandiConfig.agents)).toEqual([]);
  });

  it("names a rubric dimension for every KPI it scores", () => {
    // `scoreRun` looks each rubric key up among the KPIs; a dimension with no
    // KPI scores a flat zero and drags every result toward the middle.
    const kpis = new Set(kpisForSeat(0).map((k) => k.key));
    for (const dim of mandiRubric) expect(kpis.has(dim.key)).toBe(true);
    expect(kpis.has(mandiConfig.primaryKpi)).toBe(true);
  });

  it("keeps every non-primary KPI inside [0,1]", () => {
    // `scoreSeat` scales those straight to a 0–100 dimension, so one that could
    // exceed 1 would clamp and stop discriminating at the top.
    for (const kpi of kpisForSeat(0)) {
      if (kpi.key === mandiConfig.primaryKpi) continue;
      expect(["ratioOfSums", "marginOfSums"]).toContain(kpi.formula.kind);
    }
  });

  it("registers its format, so a result can be rendered", () => {
    expect(getFormat(arenaFormat.slug)).toBe(arenaFormat);
    expect(arenaFormat.rubric).toBe(mandiRubric);
  });
});

describe("personas", () => {
  it("deals a different table from a different seed, and the same one twice", () => {
    expect(dealPersonas("seed-a", 4)).toEqual(dealPersonas("seed-a", 4));
    expect(dealPersonas("seed-a", 4)).not.toEqual(dealPersonas("seed-b", 4));
  });

  it("never seats the same personality twice in one match", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const dealt = dealPersonas(seed, 4);
      expect(new Set(dealt).size).toBe(4);
    }
  });

  it("gives every persona a line for every move it can make", () => {
    // The lines are what keep the game at zero LLM tokens. A missing one is a
    // silent blank in the market chatter.
    const actions = mandiConfig.agents[0].actions.map((a) => a.id);
    for (const persona of PERSONAS) {
      for (const action of actions) {
        expect(persona.lines[action], `${persona.id} has no line for ${action}`).toBeTruthy();
      }
    }
  });

  it("wires a persona to the seat it is sitting in", () => {
    const agent = agentFor("discounter", 2);
    expect(agent.beliefKey).toBe("peace2");
    for (const action of agent.actions) {
      expect(Object.keys(action.offers).every((k) => k.startsWith("p2"))).toBe(true);
    }
  });
});
