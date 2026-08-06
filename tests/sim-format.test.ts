/**
 * Every rounding decision the simulation UI makes.
 *
 * Worth its own suite because the two worst display faults this app has shipped
 * were both here and both invisible to every other test: a ROAS of 4 rendered
 * as "399.0%", and a ₹0.18 cost per impression rendered as "₹0".
 */

import { describe, expect, it } from "vitest";
import { formatValue } from "@/components/simulation/format";

describe("formatValue", () => {
  it("renders shares as percentages and multiples as multiples", () => {
    expect(formatValue(0.061, "ratio")).toBe("6.1%");
    expect(formatValue(0.06, "percent")).toBe("6.0%");
    // A ROAS of 4 is "4.0×" to everyone who works with it, and "399.0%" to
    // nobody — which is what `ratio` would have made of it.
    expect(formatValue(3.99, "multiple")).toBe("4.0×");
  });

  it("scales rupees to how they would be said out loud", () => {
    expect(formatValue(4.878e7, "inr")).toBe("₹4.88 cr");
    expect(formatValue(976_378, "inr")).toBe("₹9.76 L");
    expect(formatValue(640, "inr")).toBe("₹640");
    // Sub-₹100 amounts keep their paise: this is the cost-per-impression fix.
    expect(formatValue(0.18, "inr")).toBe("₹0.18");
    expect(formatValue(47.4, "inr")).toBe("₹47.40");
    expect(formatValue(8.8, "inr")).toBe("₹8.80");
  });

  it("groups whole counts the Indian way and words the large ones", () => {
    expect(formatValue(76_220, "count")).toBe("76,220");
    expect(formatValue(1_850_000, "count")).toBe("18.50 L");
    expect(formatValue(900, "count")).toBe("900");
    expect(formatValue(-8, "count")).toBe("-8");
  });

  /**
   * The regression this suite was added for. A "count" is a per-something as
   * often as it is a tally, and `Math.round` turned Lekha's opening dashboard —
   * 1.92 tickets per seat against a book average of 0.47 — into "2 against 0",
   * which is not a smaller version of the comparison, it is the opposite of one.
   */
  it("keeps the decimals on a small non-integer count", () => {
    expect(formatValue(1.92, "count")).toBe("1.92");
    expect(formatValue(0.47, "count")).toBe("0.47");
    // Padhai Plus said "payback is under two months" beside a tile reading "2".
    expect(formatValue(1.98, "count")).toBe("1.98");
    // Trailing zeros go: a 4.3 CSAT is not "4.30".
    expect(formatValue(4.3, "count")).toBe("4.3");
    expect(formatValue(1.9, "count")).toBe("1.9");
  });

  it("still rounds counts that are big enough for a decimal to be noise", () => {
    expect(formatValue(489_800.4, "count")).toBe("4.90 L");
    expect(formatValue(1_725.3, "count")).toBe("1,725");
  });

  it("renders durations in their own units", () => {
    expect(formatValue(6, "days")).toBe("6d");
    expect(formatValue(31.4, "minutes")).toBe("31 min");
    expect(formatValue(0.708, "inr_crore")).toBe("₹0.71 cr");
    expect(formatValue(70.84, "inr_lakh")).toBe("₹70.84 L");
  });
});
