import { describe, expect, it } from "vitest";
import { DEFAULT_QUESTION_ICON, iconNameForQuestion } from "@/lib/question-icon";
import { questions, categories } from "../prisma/seed-data";

const iconFor = (title: string, tags = "", categoryIcon: string | null = null) =>
  iconNameForQuestion({ title, tags, categoryIcon });

describe("iconNameForQuestion", () => {
  it("matches the subject, not the category", () => {
    expect(iconFor("Number of smartphone users in Delhi")).toBe("Smartphone");
    expect(iconFor("Cups of chai consumed in Bangalore per day")).toBe("Coffee");
    expect(iconFor("Annual umbrella demand in Mumbai")).toBe("Umbrella");
    expect(iconFor("Daily revenue of a single Delhi Metro station")).toBe("TrainFront");
  });

  it("reads tags as well as the title", () => {
    expect(iconFor("Should a maker enter this segment?", "market entry,ev,strategy")).toBe(
      "BatteryCharging",
    );
  });

  /**
   * The rule list is ordered by specificity, and these are the pairs where a
   * broader rule would otherwise swallow a narrower one.
   */
  it("prefers the narrower rule when both could match", () => {
    // "food delivery" before the generic "food"
    expect(iconFor("Online food delivery market in India per year")).toBe("Bike");
    expect(iconFor("Number of restaurants serving food in Pune")).toBe("Utensils");

    // "credit card" before "car", and before "banking" — a card question is
    // nearly always tagged banking too.
    expect(iconFor("Number of active credit cards in India", "banking,eligibility")).toBe(
      "CreditCard",
    );
    expect(iconFor("Cars manufactured in India per year", "auto,exports")).toBe("Car");

    // "electric scooter" before the generic "scooter"
    expect(iconFor("Should a two-wheeler maker enter electric scooters?")).toBe(
      "BatteryCharging",
    );

    // "hospital bed" before the generic "hospital"
    expect(iconFor("Number of hospital beds needed in India")).toBe("BedDouble");
    expect(iconFor("Number of hospitals in Chennai")).toBe("Stethoscope");
  });

  /**
   * Whole words only. Fragment matching is what let a one-character label match
   * anything in `labelMatches` before it was tightened; the same trap applies here.
   */
  it("does not match a fragment inside a longer word", () => {
    // "bat" (cricket) must not fire on "battery"
    expect(iconFor("Battery packs shipped in India")).not.toBe("Trophy");
    // "ev" must not fire on "every"
    expect(iconFor("Every household in Pune")).not.toBe("BatteryCharging");
    // "car" must not fire on "cards" or "carbon"
    expect(iconFor("Carbon credits traded in India")).not.toBe("Car");
  });

  it("matches simple plurals", () => {
    expect(iconFor("Number of auto-rickshaws in Bangalore")).toBe("CarTaxiFront");
    expect(iconFor("Annual demand for cricket bats in India")).toBe("Trophy");
  });

  it("falls back to the category icon when nothing matches", () => {
    expect(iconFor("An entirely unremarkable question", "", "HeartPulse")).toBe("HeartPulse");
  });

  it("falls back to the default when there is no category icon either", () => {
    expect(iconFor("An entirely unremarkable question")).toBe(DEFAULT_QUESTION_ICON);
    expect(iconFor("An entirely unremarkable question", "", "   ")).toBe(DEFAULT_QUESTION_ICON);
  });

  it("never returns an empty name", () => {
    expect(iconFor("")).toBeTruthy();
    expect(iconFor("", "", null)).toBeTruthy();
  });
});

/**
 * What each seeded question actually resolves to, asserted by name.
 *
 * An earlier version of this only checked "not the default", which passed while
 * "credit cards" was resolving to a bank icon — its tags contain "banking", and
 * that rule sat above the card one. Naming the expected icon is what catches a
 * rule reordering that quietly changes an existing card.
 */
const EXPECTED: Record<string, string> = {
  "Annual umbrella demand in Mumbai": "Umbrella",
  "Cups of chai consumed in Bangalore per day": "Coffee",
  "Number of auto-rickshaws in Bangalore": "CarTaxiFront",
  "Number of smartphone users in Delhi": "Smartphone",
  "Annual market size for Maggi noodles in India": "Soup",
  "Online food delivery market in India per year": "Bike",
  "Annual demand for cricket bats in India": "Trophy",
  "Daily revenue of a single Delhi Metro station": "TrainFront",
  "Annual revenue of a PVR multiplex in Pune": "Clapperboard",
  "Number of school teachers in India": "GraduationCap",
  "Number of kirana stores in India": "Store",
  "Annual sales of a DMart store in Hyderabad": "Store",
  "Number of hospital beds needed in India": "BedDouble",
  "Number of insulin-dependent diabetics in India": "Syringe",
  "UPI transactions in India per day": "Landmark",
  "Daily data consumed by Jio users in India": "Wifi",
  "Number of JEE/NEET coaching centres in India": "GraduationCap",
  "Annual edtech market size in India": "MonitorPlay",
  "Annual air passengers between Mumbai and Delhi": "Plane",
  "Cars manufactured in India per year": "Car",
  "Annual toothpaste demand in India": "Sparkles",
  "Number of active credit cards in India": "CreditCard",
  "EV two-wheelers sold per year in Delhi NCR": "BatteryCharging",
  "Annual GMV of a mid-size D2C brand in India": "ShoppingBag",
  "Falling delivery margins at a food-delivery platform": "Bike",
  "Should a two-wheeler maker enter electric scooters?": "BatteryCharging",
  "NukkadEats: orders are down 9% and nobody knows why": "Bike",
};

describe("every seeded question resolves to a subject icon", () => {
  const iconBySlug = new Map(categories.map((c) => [c.slug, c.icon]));

  const resolve = (q: (typeof questions)[number]) =>
    iconNameForQuestion({
      title: q.title,
      tags: q.tags,
      categoryIcon: iconBySlug.get(q.category) ?? null,
    });

  for (const q of questions) {
    it(`${q.title}`, () => {
      const icon = resolve(q);
      expect(icon).not.toBe(DEFAULT_QUESTION_ICON);
      expect(icon).toBe(EXPECTED[q.title]);
    });
  }

  // Guards the table above against drifting out of sync with the seed file.
  it("has an expectation for every seeded question", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(questions.map((q) => q.title).sort());
  });
});
