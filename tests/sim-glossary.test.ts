import { describe, it, expect } from "vitest";
import { buildGlossary, EMPTY_GLOSSARY } from "@/lib/sim/glossary";
import type { SimTeaching } from "@/lib/sim/types";

/**
 * The index behind the hover definitions.
 *
 * The load-bearing tests here are the two refusals: that a scenario hiding its
 * metric map does not leak formulas through a tooltip, and that nothing matches
 * on a substring. A confidently-wrong definition on a familiar word is worse
 * than no definition, which is the whole reason the matching is exact.
 */

function teaching(over: Partial<SimTeaching> = {}): SimTeaching {
  return {
    primer: {
      intro: "You run an ads business.",
      terms: [
        {
          term: "ROAS",
          full: "Return on ad spend",
          plain: "How many rupees of revenue each rupee of ad spend brought back.",
          formula: "revenue ÷ ad spend",
          matters: "Below 1 you are paying for the privilege of selling.",
          driver: "roas",
        },
        {
          term: "Orders",
          plain: "How many baskets were actually paid for.",
          matters: "Every rupee downstream is built on this.",
          driver: "orders",
        },
      ],
    },
    showMetricMap: true,
    ...over,
  };
}

describe("buildGlossary", () => {
  it("is empty for a scenario that teaches no vocabulary", () => {
    // `SimTeaching` is optional — one scenario assumes fluency — so every
    // consumer has to survive nothing being authored.
    expect(buildGlossary(null).size).toBe(0);
    expect(buildGlossary(undefined).lookup("ROAS")).toBeNull();
    expect(buildGlossary(teaching({ primer: { intro: "", terms: [] } })).size).toBe(0);
    expect(EMPTY_GLOSSARY.lookup("anything")).toBeNull();
  });

  it("finds a term by its own name, ignoring case and spacing", () => {
    const g = buildGlossary(teaching());
    expect(g.lookup("ROAS")?.term).toBe("ROAS");
    expect(g.lookup("roas")?.term).toBe("ROAS");
    expect(g.lookup("  Roas  ")?.term).toBe("ROAS");
  });

  it("finds a term by its expansion", () => {
    // "CAC" on a tile, "Customer acquisition cost" in a panel title — the same
    // term is written both ways in different places.
    expect(buildGlossary(teaching()).lookup("Return on ad spend")?.term).toBe("ROAS");
  });

  it("finds a term by the driver it annotates", () => {
    // The exact join the metric map uses: MetricMapNode.id === SimPrimerTerm.driver.
    expect(buildGlossary(teaching()).lookup("roas")?.term).toBe("ROAS");
    expect(buildGlossary(teaching()).lookup("orders")?.term).toBe("Orders");
  });

  it("tolerates the trailing punctuation panel titles carry", () => {
    expect(buildGlossary(teaching()).lookup("Orders:")?.term).toBe("Orders");
    expect(buildGlossary(teaching()).lookup("Orders?")?.term).toBe("Orders");
  });

  it("refuses to match a substring", () => {
    // "Order value" is not "Orders", and answering as though it were would put a
    // wrong definition on a word the student is trying to learn.
    const g = buildGlossary(teaching());
    expect(g.lookup("Order value")).toBeNull();
    expect(g.lookup("Orders per rider")).toBeNull();
    expect(g.lookup("Blended ROAS")).toBeNull();
    expect(g.lookup("")).toBeNull();
  });

  it("ships the formula when the scenario also shows its metric map", () => {
    expect(buildGlossary(teaching({ showMetricMap: true })).lookup("ROAS")?.formula).toBe(
      "revenue ÷ ad spend",
    );
  });

  it("withholds the formula when the metric map is hidden", () => {
    // The map is opt-in because on a hard scenario the SHAPE of the model is
    // most of the answer. A formula names its inputs, so surfacing it on hover
    // would hand over exactly what the map is withholding.
    const g = buildGlossary(teaching({ showMetricMap: false }));
    const entry = g.lookup("ROAS");
    expect(entry?.formula).toBeUndefined();
    // Everything that is not the model's shape still ships.
    expect(entry?.plain).toContain("rupees of revenue");
    expect(entry?.matters).toContain("paying for the privilege");
  });

  it("lets an authored term win a collision with another term's expansion", () => {
    const g = buildGlossary(
      teaching({
        primer: {
          intro: "",
          terms: [
            { term: "Orders", plain: "The real one.", matters: "It is the real one." },
            { term: "X", full: "Orders", plain: "The impostor.", matters: "It is not." },
          ],
        },
      }),
    );
    expect(g.lookup("Orders")?.plain).toBe("The real one.");
  });

  it("reports the number of terms, not the number of keys", () => {
    // Each term is indexed up to three ways; `size` is what a UI would show.
    expect(buildGlossary(teaching()).size).toBe(2);
  });
});
