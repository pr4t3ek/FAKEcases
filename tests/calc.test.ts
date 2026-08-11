import { describe, it, expect } from "vitest";
import { CALCULATOR_KEYS, evaluateExpression, resultForms } from "@/lib/calc";
import { formatIndianNumber } from "@/lib/utils";

describe("evaluateExpression", () => {
  it("evaluates basic arithmetic with precedence", () => {
    expect(evaluateExpression("2 + 3 * 4")).toBe(14);
    expect(evaluateExpression("(2 + 3) * 4")).toBe(20);
    expect(evaluateExpression("100 / 4")).toBe(25);
  });

  it("supports Indian unit suffixes", () => {
    expect(evaluateExpression("2cr")).toBe(20000000);
    expect(evaluateExpression("70L")).toBe(7000000);
    expect(evaluateExpression("5k")).toBe(5000);
    expect(evaluateExpression("2cr * 0.7 / 2")).toBe(7000000);
  });

  it("accepts × and x as multiplication", () => {
    expect(evaluateExpression("30 × 4")).toBe(120);
    expect(evaluateExpression("30x4")).toBe(120);
    expect(evaluateExpression("3 X 4")).toBe(12);
    expect(evaluateExpression("2cr x 3")).toBe(60000000);
    expect(evaluateExpression("(2 + 3) × 4")).toBe(20);
    // A bare "x" is still not an expression, and a suffix is left intact.
    expect(evaluateExpression("x 4")).toBeNull();
    expect(evaluateExpression("2 x")).toBeNull();
    expect(evaluateExpression("70L")).toBe(7000000);
  });

  it("strips commas", () => {
    expect(evaluateExpression("2,00,00,000 * 0.7")).toBe(14000000);
  });

  it("returns null for invalid input", () => {
    expect(evaluateExpression("2 +")).toBeNull();
    expect(evaluateExpression("abc")).toBeNull();
    expect(evaluateExpression("(2 + 3")).toBeNull();
    expect(evaluateExpression("")).toBeNull();
  });

  it("guards against divide-by-zero", () => {
    expect(evaluateExpression("5 / 0")).toBeNull();
  });
});

/**
 * How a result is shown.
 *
 * Two defects lived on one line: the display printed the grouped number and the
 * lakh/crore shorthand unconditionally, so "48 · 48" below a thousand; and it
 * formatted through the shared INTEGER formatter, so `44 / 8` answered "6".
 */
describe("resultForms", () => {
  it("shows a small result once, not twice", () => {
    // The reported case. Both forms are "48", so the second is noise.
    expect(resultForms(48)).toEqual({ exact: "48", short: null });
    expect(resultForms(7)).toEqual({ exact: "7", short: null });
  });

  it("keeps the shorthand where it actually says something new", () => {
    expect(resultForms(14000000)).toEqual({ exact: "1,40,00,000", short: "1.40 cr" });
    expect(resultForms(4500000)).toEqual({ exact: "45,00,000", short: "45.00 L" });
    expect(resultForms(1234)).toEqual({ exact: "1,234", short: "1.2K" });
  });

  it("does not round a fraction away", () => {
    // A calculator that answers 6 to 44/8 is wrong, not tidy.
    expect(resultForms(evaluateExpression("44/8")!).exact).toBe("5.5");
    expect(resultForms(0.75).exact).toBe("0.75");
    expect(resultForms(0.5).exact).toBe("0.5");
  });

  it("never offers a rounded integer as the second form", () => {
    // The defect the browser run caught and this suite had missed by asserting
    // only `exact`: 44/8 rendered "5.5 · 6" — the shorthand duplicating the
    // answer AND rounding it. Nothing under a thousand gets a second form.
    expect(resultForms(5.5)).toEqual({ exact: "5.5", short: null });
    expect(resultForms(999.5)).toEqual({ exact: "999.5", short: null });
    expect(resultForms(0.75).short).toBeNull();
  });

  it("does not print trailing zeros on an exact result", () => {
    expect(resultForms(evaluateExpression("44+4")!).exact).toBe("48");
    expect(resultForms(100).exact).toBe("100");
  });

  it("handles negatives without inventing a minus sign", () => {
    expect(resultForms(-5.5).exact).toBe("-5.5");
    expect(resultForms(-0.001).exact).toBe("0");
  });

  it("offers exactly the operators the parser accepts", () => {
    for (const key of CALCULATOR_KEYS) {
      expect(evaluateExpression(`8 ${key === "(" || key === ")" ? "+" : key} 2`)).not.toBeNull();
    }
    expect([...CALCULATOR_KEYS]).toEqual(["+", "-", "*", "/", "(", ")"]);
    expect(evaluateExpression("(8 + 2) * 3")).toBe(30);
  });
});

describe("formatIndianNumber decimals", () => {
  it("still formats integers exactly as it did", () => {
    // Every other caller passes no second argument and must be unaffected.
    expect(formatIndianNumber(0)).toBe("0");
    expect(formatIndianNumber(999)).toBe("999");
    expect(formatIndianNumber(1234)).toBe("1,234");
    expect(formatIndianNumber(14000000)).toBe("1,40,00,000");
    expect(formatIndianNumber(-1234)).toBe("-1,234");
    expect(formatIndianNumber(5.5)).toBe("6");
    expect(formatIndianNumber(Infinity)).toBe("—");
  });

  it("keeps decimals when asked, and drops the padding", () => {
    expect(formatIndianNumber(5.5, 2)).toBe("5.5");
    expect(formatIndianNumber(5.25, 2)).toBe("5.25");
    expect(formatIndianNumber(5, 2)).toBe("5");
    expect(formatIndianNumber(1234.5, 2)).toBe("1,234.5");
  });
});
