import { describe, expect, it } from "vitest";
import {
  childrenFor,
  completeLabel,
  detectFramework,
  hintsFor,
  rootsFor,
} from "@/lib/framework-suggest";
import { FRAMEWORKS, frameworkBySlug } from "@/lib/config/frameworks";

const profitability = frameworkBySlug("profitability")!;
const marketEntry = frameworkBySlug("market-entry")!;
const pricing = frameworkBySlug("pricing")!;
const growth = frameworkBySlug("growth")!;

describe("childrenFor", () => {
  it("offers a branch's children by name, wherever it sits", () => {
    const kids = childrenFor(profitability, "Cost").map((c) => c.label);
    expect(kids).toEqual(["Primary Activities", "Support Activities"]);
  });

  it("matches the author's wording through an alias", () => {
    // "Volume" is the author's word; the casebook says "Number of Units".
    expect(childrenFor(profitability, "Volume").length).toBeGreaterThan(0);
    expect(childrenFor(marketEntry, "Mode of Entry").map((c) => c.label)).toEqual([
      "Organic",
      "Inorganic",
    ]);
  });

  it("returns nothing for a leaf", () => {
    expect(childrenFor(profitability, "Product Mix")).toEqual([]);
  });

  it("returns nothing when no framework has been settled on", () => {
    expect(childrenFor(null, "Cost")).toEqual([]);
  });

  it("gives the framework's top level for the opening move", () => {
    expect(rootsFor(profitability).map((c) => c.label)).toEqual(["Revenue", "Cost"]);
  });
});

describe("completeLabel", () => {
  it("completes a partly-typed branch", () => {
    expect(completeLabel("profit", null)).toMatch(/profit/i);
    expect(completeLabel("break", marketEntry)).toBeNull(); // a hint, not a node
  });

  it("prefers the shortest match, not the first", () => {
    expect(completeLabel("cos", profitability)).toBe("Cost");
  });

  it("prefers the current framework's own vocabulary", () => {
    const inPricing = completeLabel("value b", pricing);
    expect(inPricing).toMatch(/value based/i);
  });

  // Cross-framework branches are normal — a growth case hangs a profitability
  // subtree off ARPU — so completion falls back to the whole corpus.
  it("falls back to the whole corpus for a branch from elsewhere", () => {
    expect(completeLabel("diversif", profitability)).toMatch(/diversification/i);
  });

  it("stays quiet on one or two characters, and on an exact match", () => {
    expect(completeLabel("c", profitability)).toBeNull();
    expect(completeLabel("Cost", profitability)).toBeNull();
  });
});

describe("detectFramework", () => {
  // The whole point: shared vocabulary decides nothing, unique leaves decide
  // everything.
  it("is not fooled by a term several frameworks share", () => {
    // "Acquisition" is a Mode of Entry, a route to Inorganic Growth, and the
    // subject of the M&A framework.
    expect(detectFramework(["Acquisition"]).confident).toBe(false);
    // Singular and plural must not split a shared concept into two unique ones.
    expect(detectFramework(["Joint Venture"]).confident).toBe(false);
    expect(detectFramework(["Joint Ventures"]).confident).toBe(false);
  });

  // Worth pinning because the prose intuition ("cost is everywhere, ignore it")
  // is wrong against this corpus: Pricing's branch is "Cost Based", so a branch
  // called exactly "Cost" really is unique to Profitability, and offering its
  // children there is right.
  it("resolves an exact branch name that only one framework uses", () => {
    expect(detectFramework(["Cost"]).framework?.slug).toBe("profitability");
  });

  it("is decided by a term only one framework has", () => {
    expect(detectFramework(["Break-even analysis"]).framework?.slug).toBeDefined();
    expect(detectFramework(["Diversification"]).framework?.slug).toBe("growth");
    expect(detectFramework(["Perceived Value to Customer"]).framework?.slug).toBe("pricing");
    expect(detectFramework(["Product Mix", "Supply"]).framework?.slug).toBe("profitability");
  });

  it("accumulates across every label in the tree, not just the last", () => {
    const guess = detectFramework(["Strategic Objective", "Barriers to Entry", "How to Enter?"]);
    expect(guess.framework?.slug).toBe("market-entry");
    expect(guess.confident).toBe(true);
  });

  // The question knows what it is; that is a fact, not an inference.
  it("lets the question's declared framework outrank the labels", () => {
    const guess = detectFramework(["Cost"], { authored: "pricing" });
    expect(guess.framework?.slug).toBe("pricing");
  });

  // A tree shouldn't switch framework because one ambiguous branch arrived late.
  it("is sticky once a framework is established", () => {
    const guess = detectFramework(["Cost", "Joint Venture"], { established: "market-entry" });
    expect(guess.framework?.slug).toBe("market-entry");
  });

  it("offers a chooser rather than guessing when two are close", () => {
    const guess = detectFramework(["Joint Venture"]);
    if (!guess.confident) {
      expect(guess.framework).toBeNull();
      expect(guess.candidates.length).toBeGreaterThan(1);
    }
  });

  it("returns nothing for a tree with no recognisable vocabulary", () => {
    const guess = detectFramework(["Zebra", "Xylophone"]);
    expect(guess.framework).toBeNull();
    expect(guess.candidates).toEqual([]);
  });
});

describe("the corpus itself", () => {
  it("keeps every framework detectable by at least one decisive term", () => {
    // A future framework must not render an existing one undetectable: term
    // weights are relative to the corpus, so adding one re-weights all of them.
    for (const framework of FRAMEWORKS) {
      const own: string[] = [];
      const walk = (nodes: typeof framework.children) => {
        for (const n of nodes) {
          own.push(n.label, ...(n.aliases ?? []));
          if (n.children) walk(n.children);
        }
      };
      walk(framework.children);
      const decisive = own.filter(
        (label) => detectFramework([label]).framework?.slug === framework.slug,
      );
      expect(decisive.length, `${framework.slug} has no decisive term`).toBeGreaterThan(0);
    }
  });

  it("gives every framework trigger words and a top level", () => {
    for (const f of FRAMEWORKS) {
      expect(f.triggers.length, `${f.slug} triggers`).toBeGreaterThan(0);
      expect(f.children.length, `${f.slug} children`).toBeGreaterThan(0);
    }
  });

  it("has unique slugs", () => {
    const slugs = FRAMEWORKS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("hintsFor", () => {
  // A corpus leaf carries hints instead of children. Without surfacing them the
  // deepest level of a Guided tree is a dead end and the most specific detail in
  // the corpus is never seen.
  it("gives a leaf's prompts", () => {
    const hints = hintsFor(profitability, "Procuring Raw Materials");
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.join(" ")).toMatch(/raw materials/i);
  });

  it("reaches a leaf through an alias", () => {
    expect(hintsFor(profitability, "Pre-Purchase").join(" ")).toMatch(/awareness/i);
  });

  it("is empty for a branch that has real children instead", () => {
    expect(hintsFor(profitability, "Cost")).toEqual([]);
  });

  it("is empty without a framework, or for an unknown branch", () => {
    expect(hintsFor(null, "Anything")).toEqual([]);
    expect(hintsFor(profitability, "Zebra")).toEqual([]);
  });
});
