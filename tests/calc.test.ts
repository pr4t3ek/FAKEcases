import { describe, it, expect } from "vitest";
import { evaluateExpression } from "@/lib/calc";

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
