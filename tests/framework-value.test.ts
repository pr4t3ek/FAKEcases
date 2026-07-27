import { describe, expect, it } from "vitest";
import {
  isLegacyChildRate,
  isLegacyChildValue,
  percentDisplay,
  percentStore,
  sanitizePercentInput,
  sanitizeRateInput,
} from "@/lib/framework-value";

describe("sanitizePercentInput", () => {
  it("accepts a bare 0-100 share, including mid-entry decimals", () => {
    expect(sanitizePercentInput("")).toBe("");
    expect(sanitizePercentInput("0")).toBe("0");
    expect(sanitizePercentInput("45")).toBe("45");
    expect(sanitizePercentInput("45.")).toBe("45.");
    expect(sanitizePercentInput("45.5")).toBe("45.5");
    expect(sanitizePercentInput("100")).toBe("100");
  });

  it("rejects anything above 100, leaving the box on its last value", () => {
    expect(sanitizePercentInput("101")).toBeNull();
    expect(sanitizePercentInput("250")).toBeNull();
  });

  // Filtering rather than rejecting is what lets a field holding legacy text
  // be backspaced out of — a strict reject would strand the user on "1.3c".
  it("strips characters that can't belong in a share", () => {
    expect(sanitizePercentInput("45%")).toBe("45");
    expect(sanitizePercentInput("1.3cr")).toBe("1.3");
    expect(sanitizePercentInput("-5")).toBe("5");
    expect(sanitizePercentInput("4.5.5")).toBe("4.55");
    expect(sanitizePercentInput("abc")).toBe("");
  });

  it("rejects a value that isn't a number yet", () => {
    expect(sanitizePercentInput(".")).toBeNull();
  });
});

describe("sanitizeRateInput", () => {
  it("accepts a positive number with no upper bound", () => {
    expect(sanitizeRateInput("")).toBe("");
    expect(sanitizeRateInput("3")).toBe("3");
    expect(sanitizeRateInput("1.5")).toBe("1.5");
    expect(sanitizeRateInput("365")).toBe("365");
  });

  it("strips suffixes and operators", () => {
    expect(sanitizeRateInput("1.3cr")).toBe("1.3");
    expect(sanitizeRateInput("3 * 4")).toBe("34");
    expect(sanitizeRateInput("-2")).toBe("2");
  });
});

describe("percent storage round-trip", () => {
  it("keeps the stored '%' format everything downstream expects", () => {
    expect(percentStore("45")).toBe("45%");
    expect(percentStore("")).toBe("");
    expect(percentStore("  ")).toBe("");
    expect(percentDisplay("45%")).toBe("45");
    expect(percentDisplay("45")).toBe("45");
    expect(percentDisplay(null)).toBe("");
    expect(percentDisplay(undefined)).toBe("");
    expect(percentDisplay(percentStore("45.5"))).toBe("45.5");
  });
});

describe("legacy child data", () => {
  it("flags values this box could not have produced", () => {
    expect(isLegacyChildValue("1.3cr")).toBe(true);
    expect(isLegacyChildValue("250%")).toBe(true);
    expect(isLegacyChildValue("3 * 50%")).toBe(true);
    expect(isLegacyChildValue("100/3 %")).toBe(true);
  });

  it("leaves valid shares and empties alone", () => {
    expect(isLegacyChildValue("45%")).toBe(false);
    expect(isLegacyChildValue("100%")).toBe(false);
    expect(isLegacyChildValue("")).toBe(false);
    expect(isLegacyChildValue(null)).toBe(false);
    expect(isLegacyChildValue(undefined)).toBe(false);
  });

  it("flags rates the same way", () => {
    expect(isLegacyChildRate("1.5k")).toBe(true);
    expect(isLegacyChildRate("3 * 4")).toBe(true);
    expect(isLegacyChildRate("52")).toBe(false);
    expect(isLegacyChildRate("")).toBe(false);
    expect(isLegacyChildRate(null)).toBe(false);
  });
});
