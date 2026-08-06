/**
 * The institutions a candidate can pick from.
 *
 * A curated list rather than a free-text box, and the reason is grouping. This
 * field exists so people can eventually be ranked against their own campus, and
 * free text destroys that before it starts: "IIM-B", "IIM Bangalore" and "iim
 * blr" are one school and three leaderboards. Normalising on save only moves
 * the problem — it collapses the spellings you thought of and fragments on the
 * ones you didn't.
 *
 * So the id is the grouping key, the label is display, and anything not on the
 * list is honestly `COLLEGE_OTHER`: stored as written, shown on the profile,
 * and grouped by nothing. Adding a school here is a one-line change that
 * promotes everyone who wrote it in.
 *
 * India-only, like every other piece of content in the app.
 *
 * Not exported through `lib/config/index.ts`, following `./frameworks.ts` —
 * authored content that a few modules import by full path, rather than
 * tunables everything reads.
 */

export const COLLEGE_KINDS = ["iim", "iit", "bschool", "university"] as const;
export type CollegeKind = (typeof COLLEGE_KINDS)[number];

export const COLLEGE_KIND_LABELS: Record<CollegeKind, string> = {
  iim: "IIMs",
  iit: "IITs",
  bschool: "Business schools",
  university: "Universities & colleges",
};

export interface College {
  /** Stable grouping key. Never renamed — a rename orphans everyone on it. */
  id: string;
  name: string;
  kind: CollegeKind;
  city: string;
}

/**
 * The sentinel for "not on this list".
 *
 * A real value rather than an empty option, so the form can tell "picked Other
 * and typed something" apart from "hasn't answered yet". It is never written to
 * `User.collegeId` — that column takes a real id or null.
 */
export const COLLEGE_OTHER = "other";

export const COLLEGES: College[] = [
  // ── IIMs ──
  { id: "iim-ahmedabad", name: "IIM Ahmedabad", kind: "iim", city: "Ahmedabad" },
  { id: "iim-bangalore", name: "IIM Bangalore", kind: "iim", city: "Bengaluru" },
  { id: "iim-calcutta", name: "IIM Calcutta", kind: "iim", city: "Kolkata" },
  { id: "iim-lucknow", name: "IIM Lucknow", kind: "iim", city: "Lucknow" },
  { id: "iim-kozhikode", name: "IIM Kozhikode", kind: "iim", city: "Kozhikode" },
  { id: "iim-indore", name: "IIM Indore", kind: "iim", city: "Indore" },
  { id: "iim-shillong", name: "IIM Shillong", kind: "iim", city: "Shillong" },
  { id: "iim-rohtak", name: "IIM Rohtak", kind: "iim", city: "Rohtak" },
  { id: "iim-udaipur", name: "IIM Udaipur", kind: "iim", city: "Udaipur" },
  { id: "iim-raipur", name: "IIM Raipur", kind: "iim", city: "Raipur" },
  { id: "iim-ranchi", name: "IIM Ranchi", kind: "iim", city: "Ranchi" },
  { id: "iim-trichy", name: "IIM Tiruchirappalli", kind: "iim", city: "Tiruchirappalli" },
  { id: "iim-kashipur", name: "IIM Kashipur", kind: "iim", city: "Kashipur" },
  { id: "iim-nagpur", name: "IIM Nagpur", kind: "iim", city: "Nagpur" },
  { id: "iim-visakhapatnam", name: "IIM Visakhapatnam", kind: "iim", city: "Visakhapatnam" },
  { id: "iim-amritsar", name: "IIM Amritsar", kind: "iim", city: "Amritsar" },
  { id: "iim-bodhgaya", name: "IIM Bodh Gaya", kind: "iim", city: "Bodh Gaya" },
  { id: "iim-jammu", name: "IIM Jammu", kind: "iim", city: "Jammu" },
  { id: "iim-sambalpur", name: "IIM Sambalpur", kind: "iim", city: "Sambalpur" },
  { id: "iim-sirmaur", name: "IIM Sirmaur", kind: "iim", city: "Sirmaur" },
  { id: "iim-mumbai", name: "IIM Mumbai", kind: "iim", city: "Mumbai" },

  // ── IITs (the ones with large management / consulting-bound cohorts) ──
  { id: "iit-bombay", name: "IIT Bombay", kind: "iit", city: "Mumbai" },
  { id: "iit-delhi", name: "IIT Delhi", kind: "iit", city: "New Delhi" },
  { id: "iit-madras", name: "IIT Madras", kind: "iit", city: "Chennai" },
  { id: "iit-kanpur", name: "IIT Kanpur", kind: "iit", city: "Kanpur" },
  { id: "iit-kharagpur", name: "IIT Kharagpur", kind: "iit", city: "Kharagpur" },
  { id: "iit-roorkee", name: "IIT Roorkee", kind: "iit", city: "Roorkee" },
  { id: "iit-guwahati", name: "IIT Guwahati", kind: "iit", city: "Guwahati" },
  { id: "iit-hyderabad", name: "IIT Hyderabad", kind: "iit", city: "Hyderabad" },
  { id: "iit-bhu", name: "IIT (BHU) Varanasi", kind: "iit", city: "Varanasi" },

  // ── Other business schools ──
  { id: "isb", name: "Indian School of Business (ISB)", kind: "bschool", city: "Hyderabad" },
  { id: "xlri", name: "XLRI Jamshedpur", kind: "bschool", city: "Jamshedpur" },
  { id: "fms-delhi", name: "FMS Delhi", kind: "bschool", city: "New Delhi" },
  { id: "spjimr", name: "SPJIMR Mumbai", kind: "bschool", city: "Mumbai" },
  { id: "mdi-gurgaon", name: "MDI Gurgaon", kind: "bschool", city: "Gurugram" },
  { id: "jbims", name: "JBIMS Mumbai", kind: "bschool", city: "Mumbai" },
  { id: "iift", name: "IIFT", kind: "bschool", city: "New Delhi" },
  { id: "nmims", name: "NMIMS Mumbai", kind: "bschool", city: "Mumbai" },
  { id: "simsree", name: "SIMSREE Mumbai", kind: "bschool", city: "Mumbai" },
  { id: "symbiosis-scmhrd", name: "SCMHRD Pune", kind: "bschool", city: "Pune" },
  { id: "sibm-pune", name: "SIBM Pune", kind: "bschool", city: "Pune" },
  { id: "tiss", name: "TISS Mumbai", kind: "bschool", city: "Mumbai" },
  { id: "imt-ghaziabad", name: "IMT Ghaziabad", kind: "bschool", city: "Ghaziabad" },
  { id: "great-lakes", name: "Great Lakes Chennai", kind: "bschool", city: "Chennai" },
  { id: "iri-xim", name: "XIM Bhubaneswar", kind: "bschool", city: "Bhubaneswar" },

  // ── Universities & undergraduate colleges ──
  { id: "srcc", name: "SRCC, Delhi University", kind: "university", city: "New Delhi" },
  { id: "lsr", name: "Lady Shri Ram College", kind: "university", city: "New Delhi" },
  { id: "hindu-college", name: "Hindu College, Delhi University", kind: "university", city: "New Delhi" },
  { id: "st-stephens", name: "St. Stephen's College", kind: "university", city: "New Delhi" },
  { id: "delhi-university", name: "Delhi University (other college)", kind: "university", city: "New Delhi" },
  { id: "mumbai-university", name: "University of Mumbai", kind: "university", city: "Mumbai" },
  { id: "christ-university", name: "Christ University", kind: "university", city: "Bengaluru" },
  { id: "symbiosis-university", name: "Symbiosis International University", kind: "university", city: "Pune" },
  { id: "manipal", name: "Manipal Academy of Higher Education", kind: "university", city: "Manipal" },
  { id: "vit", name: "VIT Vellore", kind: "university", city: "Vellore" },
  { id: "bits-pilani", name: "BITS Pilani", kind: "university", city: "Pilani" },
  { id: "nit-trichy", name: "NIT Tiruchirappalli", kind: "university", city: "Tiruchirappalli" },
  { id: "anna-university", name: "Anna University", kind: "university", city: "Chennai" },
  { id: "jadavpur", name: "Jadavpur University", kind: "university", city: "Kolkata" },
];

const BY_ID: Record<string, College> = Object.fromEntries(
  COLLEGES.map((c) => [c.id, c]),
);

/** Undefined for an unknown id rather than throwing: a stored id can outlive a
 *  list entry, and a profile should still render if one is ever removed. */
export function collegeById(id: string | null | undefined): College | undefined {
  return id ? BY_ID[id] : undefined;
}

/** True for an id this list actually knows. Used to validate what's submitted. */
export function isKnownCollege(id: string): boolean {
  return id in BY_ID;
}

/** Grouped for an `<optgroup>`-per-kind select, in `COLLEGE_KINDS` order. */
export function collegesByKind(): { kind: CollegeKind; label: string; colleges: College[] }[] {
  return COLLEGE_KINDS.map((kind) => ({
    kind,
    label: COLLEGE_KIND_LABELS[kind],
    colleges: COLLEGES.filter((c) => c.kind === kind),
  })).filter((g) => g.colleges.length > 0);
}
