/**
 * Which icon represents a question's subject.
 *
 * A library of cards that differ only in their text is hard to scan, so each one
 * carries an icon for what it is actually about — a phone for a smartphone
 * question, a train for a metro one. The subject is read off the title and tags
 * rather than authored, so a question added through the admin panel or a CSV
 * import gets an icon without anybody choosing one.
 *
 * Returns the icon *name*. Keeping this module free of React is what lets it be
 * unit-tested as a plain function, and it matches how `Category.icon` has always
 * stored its value.
 */

/** Shown when a question matches nothing and its category has no icon either. */
export const DEFAULT_QUESTION_ICON = "Lightbulb";

/**
 * Ordered rules: the FIRST match wins, so this list doubles as the specificity
 * ordering. A narrow term has to come before any broader one that contains it —
 * "smartphone" before "phone", "food delivery" before "food", "credit card"
 * before "car" — or the general rule swallows the specific one.
 *
 * Patterns are whole words (a trailing "s"/"es" is matched for you), so
 * inflections that aren't plurals are spelled out rather than stemmed. Stems
 * would quietly re-introduce the fragment matching this deliberately avoids.
 */
const RULES: { icon: string; patterns: string[] }[] = [
  // ── Specific subjects, narrowest first ──────────────────────────────────
  { icon: "Umbrella", patterns: ["umbrella", "monsoon"] },
  { icon: "Coffee", patterns: ["chai", "tea", "coffee", "cafe"] },
  { icon: "Soup", patterns: ["noodle", "maggi"] },
  { icon: "Bike", patterns: ["food delivery", "food-delivery", "delivery platform", "courier"] },
  { icon: "CarTaxiFront", patterns: ["auto-rickshaw", "auto rickshaw", "rickshaw", "taxi", "cab"] },
  { icon: "TrainFront", patterns: ["metro", "railway", "train"] },
  { icon: "Plane", patterns: ["air passenger", "airline", "flight", "airport", "aviation"] },
  { icon: "Clapperboard", patterns: ["multiplex", "cinema", "movie", "pvr", "theatre"] },
  { icon: "Trophy", patterns: ["cricket", "sport", "stadium", "bat"] },
  { icon: "Syringe", patterns: ["insulin", "diabetic", "diabetes", "vaccine"] },
  { icon: "BedDouble", patterns: ["hospital bed", "bed"] },
  { icon: "Stethoscope", patterns: ["hospital", "clinic", "doctor", "patient", "pharmacy", "chemist"] },
  { icon: "Shirt", patterns: ["apparel", "garment", "textile"] },
  // Before the banking rule below: "Deccan Ceramics: … the bank wants a word"
  // is a question about a tile factory, and the bank is in the sentence rather
  // than in the subject.
  { icon: "Factory", patterns: ["ceramic", "tile", "kiln"] },
  { icon: "Store", patterns: ["kirana", "dmart", "supermarket", "grocery", "store"] },
  { icon: "GraduationCap", patterns: ["coaching", "jee", "neet", "teacher", "school", "college", "student"] },
  { icon: "MonitorPlay", patterns: ["edtech", "online course", "e-learning"] },
  { icon: "Smartphone", patterns: ["smartphone", "mobile phone", "handset", "phone"] },
  { icon: "Wifi", patterns: ["data consumed", "data consumption", "internet", "broadband", "telecom", "jio", "streaming"] },
  // Before the banking rule: a card question is nearly always tagged "banking"
  // too, and the card is the more specific subject.
  { icon: "CreditCard", patterns: ["credit card", "debit card", "card"] },
  { icon: "Landmark", patterns: ["upi", "bank", "banking", "atm", "payment", "npci", "transaction"] },
  { icon: "BatteryCharging", patterns: ["ev", "electric scooter", "electric vehicle", "charging"] },
  { icon: "Car", patterns: ["car", "automobile", "vehicle", "two-wheeler", "scooter", "motorcycle"] },
  { icon: "Sparkles", patterns: ["toothpaste", "soap", "shampoo", "detergent"] },
  { icon: "ShoppingBag", patterns: ["d2c", "ecommerce", "e-commerce", "gmv", "online shopping"] },
  { icon: "Zap", patterns: ["electricity", "solar", "energy"] },
  { icon: "Factory", patterns: ["manufactured", "manufacturing", "manufacture", "factory"] },
  { icon: "Home", patterns: ["household", "housing", "apartment", "real estate"] },
  { icon: "Users", patterns: ["population", "resident"] },

  // ── Broader shapes, only reached when nothing specific matched ──────────
  { icon: "Utensils", patterns: ["food", "restaurant", "meal"] },
  { icon: "Wallet", patterns: ["insurance", "loan", "mutual fund", "investment"] },
  { icon: "Rocket", patterns: ["startup", "unicorn", "funding"] },
  { icon: "IndianRupee", patterns: ["revenue", "sales", "turnover", "market size"] },
  // Last on purpose. "Lekha" is tagged `b2b saas` and already resolves to
  // Factory on an earlier rule; putting software anywhere above here would
  // silently repoint it, which the per-question expectations in
  // tests/question-icon.test.ts would catch but only after the fact.
  { icon: "Package", patterns: ["saas", "shipment", "logistics", "freight"] },
];

/**
 * Whole-word match with an optional plural, so "bat" finds "cricket bats" but
 * not "battery", and "ev" finds "EV two-wheelers" but not "every".
 */
function mentions(haystack: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:e?s)?\\b`).test(haystack);
}

export interface QuestionIconInput {
  title: string;
  tags?: string | null;
  /** `Category.icon` — a lucide name, already stored for every seeded category. */
  categoryIcon?: string | null;
}

export function iconNameForQuestion(question: QuestionIconInput): string {
  // Commas and slashes join words that should stay separate ("JEE/NEET"), so
  // they become spaces. Hyphens are left alone — "two-wheeler" and "auto-rickshaw"
  // are single terms, and the word boundary handles them.
  const haystack = `${question.title} ${question.tags ?? ""}`
    .toLowerCase()
    .replace(/[,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const rule of RULES) {
    if (rule.patterns.some((p) => mentions(haystack, p))) return rule.icon;
  }

  // Nothing specific matched. The category always knows roughly what this is,
  // and it has carried an icon name since the schema was written — this is the
  // first thing to actually read that column.
  return question.categoryIcon?.trim() || DEFAULT_QUESTION_ICON;
}
