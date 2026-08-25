import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { chaiWalkthrough } from "@/lib/walkthrough/content";
import { parseWalkthrough, walkthroughSchema } from "@/lib/walkthrough/types";
import { validateWalkthrough } from "@/lib/walkthrough/validate";

const RANGE = { idealLow: 8_000_000, idealHigh: 22_000_000 };

/** A valid walkthrough with one thing changed. */
function mutate(change: (w: typeof chaiWalkthrough) => void) {
  const copy = JSON.parse(JSON.stringify(chaiWalkthrough)) as typeof chaiWalkthrough;
  change(copy);
  return copy;
}

describe("walkthrough validation", () => {
  it("accepts the authored example", () => {
    expect(validateWalkthrough(chaiWalkthrough, RANGE).ok).toBe(true);
  });

  it("refuses a chain that misses the question's range", () => {
    const wrong = mutate((w) => {
      w.steps[1].node.value = "5%";
    });
    const result = validateWalkthrough(wrong, RANGE);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.message).toMatch(/outside this question/i);
  });

  it("refuses a question with no range at all", () => {
    // A case, not a guesstimate. There is nothing to check the arithmetic
    // against, so an unverifiable example must not slip through the one gate
    // that exists to stop them.
    const result = validateWalkthrough(chaiWalkthrough, { idealLow: null, idealHigh: null });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.message).toMatch(/no ideal range/i);
  });

  it("refuses a child whose parent appears later", () => {
    const forward = mutate((w) => {
      w.steps[0].node.parentKey = "floating";
    });
    expect(validateWalkthrough(forward, RANGE).issues[0]?.message).toMatch(/no earlier step/i);
  });

  it("refuses duplicate keys", () => {
    const dup = mutate((w) => {
      w.steps[2].node.key = w.steps[1].node.key;
    });
    expect(validateWalkthrough(dup, RANGE).issues.some((i) => /share the key/i.test(i.message))).toBe(
      true,
    );
  });

  it("refuses a walkthrough with no root", () => {
    const rootless = mutate((w) => {
      w.steps[0].node.parentKey = "pop";
    });
    expect(validateWalkthrough(rootless, RANGE).ok).toBe(false);
  });

  it("refuses a node that parents itself", () => {
    const self = mutate((w) => {
      w.steps[1].node.parentKey = w.steps[1].node.key;
    });
    expect(validateWalkthrough(self, RANGE).issues.some((i) => /its own parent/i.test(i.message))).toBe(
      true,
    );
  });

  it("refuses malformed input outright", () => {
    expect(validateWalkthrough({ steps: "not an array" }, RANGE).ok).toBe(false);
    expect(validateWalkthrough(null, RANGE).ok).toBe(false);
  });

  it("round-trips through storage", () => {
    const stored = JSON.stringify(chaiWalkthrough);
    expect(parseWalkthrough(stored)).toEqual(walkthroughSchema.parse(chaiWalkthrough));
  });

  it("returns null for unparseable storage rather than throwing", () => {
    expect(parseWalkthrough("{ not json")).toBeNull();
    expect(parseWalkthrough("")).toBeNull();
    expect(parseWalkthrough(null)).toBeNull();
  });
});

/**
 * The player must have no way to write anything.
 *
 * A prohibition test rather than a behavioural one, in the same spirit as the
 * buyback suite grepping engine code for domain vocabulary. The real risk is
 * not that today's player persists a demo node — it plainly does not — it is
 * that somebody later reaches for the builder's canvas "just to reuse the
 * card", and the builder debounce-saves its whole node array. A demo branch
 * that reached it would be written to the database and then scored.
 */
describe("the player cannot persist anything", () => {
  const source = readFileSync("components/practice/walkthrough-player.tsx", "utf8");

  it("imports no server action", () => {
    expect(source).not.toMatch(/from "@\/app\/actions/);
  });

  it("imports no database access", () => {
    expect(source).not.toMatch(/from "@\/lib\/db"/);
    expect(source).not.toMatch(/from "@\/lib\/walkthrough"/);
  });

  it("does not reach for the live builder or its canvas", () => {
    expect(source).not.toMatch(/framework-builder/);
    expect(source).not.toMatch(/framework-canvas/);
  });

  it("issues no requests of its own", () => {
    expect(source).not.toMatch(/\bfetch\(/);
  });

  it("holds for the button that opens it too", () => {
    // The button is the other way in, so the same prohibition has to cover it —
    // otherwise the isolation is only true of the half nobody would break.
    const button = readFileSync("components/practice/walkthrough-button.tsx", "utf8");
    expect(button).not.toMatch(/from "@\/app\/actions/);
    expect(button).not.toMatch(/from "@\/lib\/db"/);
    expect(button).not.toMatch(/framework-builder|framework-canvas/);
    expect(button).not.toMatch(/\bfetch\(/);
  });
});

/**
 * Every walkthrough written before cases existed is stored without a `kind`.
 *
 * `discriminatedUnion` picks its branch on the tag, so an untagged row matches
 * nothing unless the parser puts one back. Getting this wrong does not fail
 * loudly — `parseWalkthrough` returns null on a parse error, so every existing
 * worked example would simply stop appearing, with no error anywhere.
 */
describe("walkthroughs stored before cases existed", () => {
  const legacy = {
    intro: "A worked example.",
    steps: [
      {
        say: "Start with the pool.",
        node: { key: "pop", parentKey: null, label: "Population", value: "1.3cr", multiplier: "", combine: "sum" },
        because: "A round, defensible anchor.",
      },
      {
        say: "Cut it down.",
        node: { key: "d", parentKey: "pop", label: "Drinkers", value: "65%", multiplier: "1.5", combine: "sum" },
        because: "Roughly two in three.",
      },
    ],
    outro: "That is the method.",
  };

  it("still parse, and read as numeric", () => {
    const parsed = parseWalkthrough(JSON.stringify(legacy));
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("numeric");
  });

  it("are still checked against the question's range", () => {
    // 1.3cr x 65% x 1.5 is about 1.27cr, so a range around it passes and one
    // well below it fails — the untagged row is going through the real gate.
    const parsed = parseWalkthrough(JSON.stringify(legacy));
    expect(validateWalkthrough(parsed, { idealLow: 1.0e7, idealHigh: 1.5e7 }).ok).toBe(true);
    expect(validateWalkthrough(parsed, { idealLow: 1, idealHigh: 100 }).ok).toBe(false);
  });

  it("do not accidentally satisfy the case branch", () => {
    const parsed = parseWalkthrough(JSON.stringify({ ...legacy, kind: "case" }));
    // Tagged a case but carrying numeric nodes: no status anywhere, so the case
    // branch rejects it rather than silently defaulting every node to unknown.
    expect(parsed).toBeNull();
  });
});
