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
  "Falling turnout at a city's free neighbourhood clinics": "Stethoscope",
  // "restaurant" in the tags, not "food delivery" — the subject is the kitchen,
  // and the delivery channel is where the problem happens to surface.
  "Satisfaction slipping at a wood-fired pizza kitchen": "Utensils",
  "A small finance bank steps up to a universal licence": "Landmark",
  // No subject rule matches the title, so this reaches GraduationCap through
  // "education" in the tags — "university" is not itself a pattern.
  "Bringing foreign university campuses to an Indian state": "GraduationCap",
  // "stadium" in the tags beats "revenue" in the title, and that is the right
  // call: the card is about a football club, not about revenue in the abstract.
  "Mapping the revenue streams of a football club": "Trophy",
  "On-time performance at a newly privatised airline": "Plane",
  // Two more Category.icon fallbacks. Nothing in a title about a late partner
  // or a carbon footprint is a subject the rules have a card for, so they take
  // Transportation's and Consumer Goods' — which is what the column is for.
  "The partner who was late": "Bus",
  "Sustainability strategy for an FMCG major": "Package",
  "NukkadEats: orders are down 9% and nobody knows why": "Bike",
  "Kadak Coffee: the ads are working and the money is going": "Coffee",
  "Padhai Plus: 18,000 new subscribers a month, and a bigger hole": "GraduationCap",
  "Rangoli: the test says +6%, and the room wants it live on Monday": "ShoppingBag",
  // "kirana" in the tags beats "saas" — the app is software, but the subject on
  // the card is the shop it is sold to, and Store is the icon a reader scans for.
  "Vyapar Mitra: 38% more signups and the same 11,000 paying shops": "Store",
  "Chaska: share is up five points and the profit is down a third": "Store",
  "Ujala Solar: we planned for 10.8 lakh units and sold 4.3 lakh": "Zap",
  "Lekha: our most profitable customer wants 18% off": "Factory",
  // A retail chain whose subject is medicine: "pharmacy" in the tags reaches
  // the healthcare rule before the Retail category fallback can be used.
  "Sehat Plus: 87% availability on 24% more stock": "Stethoscope",
  // "revenue" (in "net revenue retention") outranks "logistics" in the rule
  // order, and that is the right call here: the subject is retained ARR, not
  // freight. The software happens to be sold to hauliers.
  "Setu: three quarters of shipping the most-requested features, and NRR at 94%": "IndianRupee",
  "Kirti Apparel: revenue is up 22% and profit is down 62%": "Shirt",
  "Nirmal Pipes: a record profit and no money for payroll": "Factory",
  // "ceramic" beats "bank" — the bank is in the sentence, not in the subject.
  "Deccan Ceramics: our best ever EBITDA, and the bank wants a word": "Factory",
  // Nothing in the title is a subject rule, so this reaches Factory through
  // "manufacturing" in the tags — the same card its finance-track siblings get,
  // and the right one: the subject is a stamping plant, not the bank meeting.
  "Pragati Precision: record EBITDA, and the CEO wants a hundred crore more": "Factory",
  "Meraki Textiles: twelve months, one supplier, and a clause you can abuse once": "Shirt",
  "Sutradhar: four quarters of cash and three ways to spend it": "Package",
  // No subject rule matches these four, so they exercise the Category.icon
  // fallback. The two analytics scenarios fall back to Data & Analytics rather
  // than to a lending or a fitness icon, which is the right card for both: the
  // subject is the league table and the readout, not the loan book or the gym.
  "Suraksha Home: the competitor cut price — do we match?": "LineChart",
  "Ghar Sewa: customers waiting, professionals idle, both sides growing": "LineChart",
  "Sahyog Finance: the best agency got 60% of the book, and recovery fell": "Sigma",
  "Chalo Fitness: fourteen ways to read one test, and the one that said yes": "Sigma",
  // The one analytics scenario that does NOT fall back to the category icon,
  // and it is the rule list working rather than failing. Sahyog's and Chalo's
  // titles name a book and a test; this one names a payment, which is a
  // subject the rules have a card for. A bank building is the right card for
  // UPI fraud, so this is left matching on subject like everything else.
  "Kavach Pay: the model is 99.4% accurate, and payment success is falling": "Landmark",
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
