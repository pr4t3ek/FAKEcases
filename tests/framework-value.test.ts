import { describe, expect, it } from "vitest";
import {
  isLegacyChildRate,
  isLegacyChildValue,
  percentBackspace,
  percentDisplay,
  percentField,
  percentStore,
  sanitizePercentInput,
  sanitizeRateInput,
  shareTotalFor,
  sharesOvershoot,
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

describe("percentField", () => {
  it("carries the '%' in the field text, so the box is never a bare number", () => {
    expect(percentField("45%")).toBe("45%");
    expect(percentField("45")).toBe("45%");
    expect(percentField("45.5%")).toBe("45.5%");
  });

  it("stays empty when there's no share yet", () => {
    expect(percentField("")).toBe("");
    expect(percentField(null)).toBe("");
    expect(percentField(undefined)).toBe("");
  });
});

describe("percentBackspace", () => {
  it("drops a digit rather than the suffix", () => {
    expect(percentBackspace("45%")).toBe("4%");
    expect(percentBackspace("4%")).toBe("");
    expect(percentBackspace("45.5%")).toBe("45.%");
  });

  it("is a no-op on an already-empty box", () => {
    expect(percentBackspace("")).toBe("");
    expect(percentBackspace(null)).toBe("");
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

const share = (value: string) => ({ value });

describe("shareTotalFor", () => {
  it("totals sibling percentage shares", () => {
    expect(shareTotalFor([share("70%"), share("30%")])).toBe(100);
  });

  it("returns null for a single child — one slice is not a partition", () => {
    expect(shareTotalFor([share("25%")])).toBeNull();
  });

  it("returns null when the siblings aren't all shares", () => {
    // "40%" of something plus "₹350" each isn't a partition to begin with.
    expect(shareTotalFor([share("40%"), share("350")])).toBeNull();
  });

  it("returns null when a value is a share times a rate", () => {
    // "3 * 50%" is half the segment, three each — a factor, not a slice of 100.
    expect(shareTotalFor([share("50%"), share("3 * 50%")])).toBeNull();
  });

  // The claim that prompted the change: a rate says nothing about how much of
  // the parent a branch covers, so it can never move this total.
  it("ignores the rate box entirely", () => {
    const withRates = [
      { value: "70%", multiplier: "3" },
      { value: "30%", multiplier: "52" },
    ];
    expect(shareTotalFor(withRates)).toBe(shareTotalFor([share("70%"), share("30%")]));
  });
});

describe("sharesOvershoot", () => {
  // Modelling only the slices the estimate needs — "the 25% who smoke", "the
  // 40% in cities" — is a narrowing, not a gap to be filled.
  it("does not fire when the shares fall short of the whole", () => {
    expect(sharesOvershoot(65)).toBe(false);
    expect(sharesOvershoot(25)).toBe(false);
    expect(sharesOvershoot(0)).toBe(false);
  });

  it("fires when the shares claim more than the whole", () => {
    expect(sharesOvershoot(115)).toBe(true);
  });

  it("tolerates the rounding a guesstimate invites", () => {
    expect(sharesOvershoot(99)).toBe(false);
    expect(sharesOvershoot(101)).toBe(false);
    expect(sharesOvershoot(102)).toBe(false);
    expect(sharesOvershoot(103)).toBe(true);
  });
});
