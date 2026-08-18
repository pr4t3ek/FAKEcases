/**
 * Public reference figures the interviewer may hand a candidate on request.
 *
 * A guesstimate tests structure, segmentation and the courage to commit to a
 * number — not whether someone remembers that Bangalore is closer to 1.4 crore
 * than to 80 lakh. A candidate who stalls on a population they were never going
 * to know is spending their forty minutes on the wrong thing, and in a real
 * interview they would simply ask and be told.
 *
 * So these are released the same way a case's authored facts are: through
 * `Question.dataPack`, quoted exactly, only when the candidate asks about that
 * topic, never volunteered. `renderDataPack` in `lib/llm/prompts.ts` carries the
 * instruction; this file only supplies the rows.
 *
 * ## Why they live here and not in the seed
 *
 * They are true of every guesstimate rather than of any one of them, so putting
 * them on 24 `Question` rows would be 24 copies to keep in step, and a new
 * question would silently start life without them. Config instead — beside
 * `colleges.ts`, which is India-specific content-as-data for the same reason —
 * so adding a city is a one-line edit and no migration.
 *
 * ## Two rules for editing
 *
 * **Round, and say so.** These are sizing inputs, not census citations. "~1.4
 * crore" is the right precision for a figure someone is about to multiply by a
 * guessed percentage, and it signals to the candidate that the number is an
 * anchor rather than a fact to defend.
 *
 * **Never add anything that shortcuts an answer.** A population is an input to
 * every sizing and gives none of them away. Per-capita consumption of the thing
 * being sized is the answer wearing a hat — if a figure would let a candidate
 * skip the segmentation, it belongs in that question's own `dataPack` (where the
 * author decided the trade) or nowhere.
 */

export interface ReferenceFact {
  /** Lowercase words that should trigger this fact when the candidate asks. */
  topic: string[];
  /** Quoted verbatim by the interviewer. Keep it one short sentence. */
  fact: string;
}

/**
 * Ordered loosely by how often a sizing needs them, which is also the order a
 * reader scanning this file will want.
 */
export const INDIA_REFERENCE_FACTS: ReferenceFact[] = [
  // ── National ────────────────────────────────────────────────────────────
  {
    topic: ["india", "national", "country", "population"],
    fact: "India's population is about 140 crore (1.4 billion).",
  },
  {
    topic: ["urban", "rural", "split", "urbanisation", "urbanization"],
    fact: "Roughly 35% of India lives in urban areas and 65% rural.",
  },
  {
    topic: ["household", "family", "households", "size"],
    fact: "An average Indian household is about 4.5 people; urban households are slightly smaller at around 4.",
  },
  {
    topic: ["age", "median", "young", "demographic", "demographics"],
    fact: "India's median age is about 29. Roughly 25% are under 15 and about 7% are over 65.",
  },
  {
    topic: ["income", "gdp", "per capita", "salary"],
    fact: "GDP per capita is roughly ₹2.3 lakh a year; a middle-class urban household earns broadly ₹5–15 lakh a year.",
  },
  {
    topic: ["literacy", "educated", "education"],
    fact: "Literacy is about 77% nationally, and higher in cities.",
  },
  {
    topic: ["smartphone", "mobile", "phone", "internet", "online"],
    fact: "There are roughly 60–70 crore smartphone users and about 80 crore internet users in India.",
  },

  // ── Metros ──────────────────────────────────────────────────────────────
  // Metropolitan-area figures, which is the number a sizing wants: the municipal
  // boundary excludes the suburbs the demand actually lives in.
  {
    topic: ["mumbai", "bombay"],
    fact: "Mumbai's metropolitan population is about 2.1 crore.",
  },
  {
    topic: ["delhi", "ncr", "new delhi"],
    fact: "Delhi NCR's population is about 3.2 crore; Delhi city proper is about 2 crore.",
  },
  {
    topic: ["bangalore", "bengaluru"],
    fact: "Bangalore's metropolitan population is about 1.4 crore.",
  },
  {
    topic: ["hyderabad"],
    fact: "Hyderabad's metropolitan population is about 1.1 crore.",
  },
  {
    topic: ["chennai", "madras"],
    fact: "Chennai's metropolitan population is about 1.1 crore.",
  },
  {
    topic: ["kolkata", "calcutta"],
    fact: "Kolkata's metropolitan population is about 1.5 crore.",
  },
  {
    topic: ["pune"],
    fact: "Pune's metropolitan population is about 70 lakh.",
  },
  {
    topic: ["ahmedabad"],
    fact: "Ahmedabad's metropolitan population is about 85 lakh.",
  },

  // ── City tiers ──────────────────────────────────────────────────────────
  {
    topic: ["tier 1", "tier-1", "metro", "metros", "cities"],
    fact: "India has about 8 tier-1 metros, together roughly 12 crore people.",
  },
  {
    topic: ["tier 2", "tier-2", "tier 3", "tier-3", "small towns"],
    fact: "There are roughly 100 cities with a population above 10 lakh, and about 8,000 towns in total.",
  },
];
