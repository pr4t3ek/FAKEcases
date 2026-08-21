import { describe, it, expect } from "vitest";
import { workedExample } from "@/lib/config";
import { questions as seedQuestions } from "@/prisma/seed-data";

/**
 * The figures are the teaching, so they are checked like code.
 *
 * A tutorial whose arithmetic does not close teaches an error, and nothing else
 * in the app would notice: no page renders the product, no scorer reads it, and
 * a reader trusting the walkthrough has no way to tell. Someone retuning "26
 * days" to "24" without redoing the total should fail here rather than ship it.
 */
describe("the worked example's arithmetic", () => {
  it("multiplies out to the total it claims", () => {
    const product = workedExample.steps.reduce((n, step) => n * step.factor, 1);
    expect(product).toBe(workedExample.total);
  });

  it("states a total the label actually says", () => {
    // "about 2,000 haircuts a month" against 2080 — the prose rounds, but it
    // must round to the same order of magnitude it computed.
    const spoken = Number(workedExample.totalLabel.replace(/[^0-9]/g, ""));
    expect(spoken).toBeGreaterThan(workedExample.total * 0.8);
    expect(spoken).toBeLessThan(workedExample.total * 1.2);
  });

  // The habit the example exists to teach: convert the answer into a currency
  // you have intuition about. If that conversion is itself wrong, the lesson
  // teaches a check that does not work.
  it("keeps the sanity check consistent with the total", () => {
    const { total, sanityCheck } = workedExample;
    expect(total * sanityCheck.pricePerCut).toBe(sanityCheck.monthlyRevenue);
  });

  it("quotes that revenue in the prose the reader actually sees", () => {
    // ₹3.1 lakh, against 312000.
    const lakh = workedExample.sanityCheck.monthlyRevenue / 100_000;
    expect(workedExample.sanityCheck.text).toContain(`₹${lakh.toFixed(1)} lakh`);
  });

  it("gives every step a figure and a reason", () => {
    expect(workedExample.steps.length).toBeGreaterThanOrEqual(3);
    for (const step of workedExample.steps) {
      expect(step.value.trim(), step.label).not.toBe("");
      expect(step.why.trim().length, step.label).toBeGreaterThan(20);
      expect(Number.isFinite(step.factor), step.label).toBe(true);
    }
  });
});

/**
 * A worked answer to a question in the catalogue is an answer key.
 *
 * The salon was chosen to sit outside the library, but the library grows — this
 * is what stops a future seeded "haircuts in a salon" quietly turning the
 * tutorial into the solution to a graded question.
 */
describe("the worked example is not a catalogue question", () => {
  it("matches no seeded question title", () => {
    const asked = workedExample.question.toLowerCase();
    for (const q of seedQuestions) {
      expect(asked, q.title).not.toContain(q.title.toLowerCase());
      expect(q.title.toLowerCase(), q.title).not.toContain(asked);
    }
  });

  it("is about a single shop, not a city or a country", () => {
    // The scale is the safeguard: everything seeded is city- or nation-level.
    expect(workedExample.question).toMatch(/salon/i);
    expect(workedExample.question).not.toMatch(/India|Bangalore|Mumbai|Delhi/i);
  });
});
