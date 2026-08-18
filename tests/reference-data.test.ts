import { describe, it, expect } from "vitest";
import { INDIA_REFERENCE_FACTS } from "@/lib/config/reference-data";

/**
 * The shared figures the interviewer may hand over on request.
 *
 * Pure content, so these are contract tests rather than behaviour ones: the
 * rows have to be well-formed, and — the case that matters — they must not
 * quietly contain a figure that answers a sizing outright.
 */
describe("India reference facts", () => {
  it("gives every fact at least one topic word and a sentence", () => {
    for (const f of INDIA_REFERENCE_FACTS) {
      expect(f.topic.length, `topic missing on: ${f.fact}`).toBeGreaterThan(0);
      expect(f.fact.trim().length, `empty fact for: ${f.topic}`).toBeGreaterThan(10);
    }
  });

  it("keeps topic words lowercase so matching is predictable", () => {
    for (const f of INDIA_REFERENCE_FACTS) {
      for (const t of f.topic) {
        expect(t, `"${t}" should be lowercase`).toBe(t.toLowerCase());
      }
    }
  });

  /**
   * Two rows claiming the same topic word means the interviewer has two answers
   * to one question and picks arbitrarily.
   */
  it("claims each topic word only once", () => {
    const seen = new Map<string, string>();
    for (const f of INDIA_REFERENCE_FACTS) {
      for (const t of f.topic) {
        expect(seen.has(t), `"${t}" claimed by both "${seen.get(t)}" and "${f.fact}"`).toBe(false);
        seen.set(t, f.fact);
      }
    }
  });

  /**
   * The editing rule this file states, enforced. A population is an input to
   * every sizing and gives none of them away; a per-person CONSUMPTION figure
   * for the thing being sized IS the answer, and belongs in a question's own
   * dataPack where an author weighed the trade — not in a set applied to all 24
   * guesstimates at once.
   *
   * Matched on the consumption verb rather than on "per capita", which caught
   * GDP per capita on the first run. That one is an affordability anchor a
   * candidate still has to segment and apply — an input like any other, not a
   * quantity of anything being sized.
   */
  it("holds no per-person consumption figure that would shortcut a sizing", () => {
    const shortcut =
      /\b(?:consumes?|drinks?|eats?|buys?|uses?|spends?)\b[^.;]{0,40}\bper\s+(?:person|capita|head|day|year)\b|\b(?:cups?|litres?|kg|units?|servings?)\s+per\s+(?:person|capita|head)\b/i;
    for (const f of INDIA_REFERENCE_FACTS) {
      expect(shortcut.test(f.fact), `looks like an answer, not an input: "${f.fact}"`).toBe(false);
    }
  });

  it("covers the metros a candidate is most likely to be asked about", () => {
    const claimed = new Set(INDIA_REFERENCE_FACTS.flatMap((f) => f.topic));
    for (const city of ["mumbai", "delhi", "bangalore", "chennai", "kolkata", "hyderabad", "pune"]) {
      expect(claimed.has(city), `no reference figure for ${city}`).toBe(true);
    }
  });
});
