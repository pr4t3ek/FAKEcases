/**
 * What a profile may contain, and the limits on it.
 *
 * Separate from `./practice.ts` because none of this tunes the exercise — it is
 * the shape of the person, not of the interview. The vocabularies live here
 * rather than in the form so the zod schema, the select and any future report
 * all read the same list; a profession that exists in the dropdown but not in
 * the validator is a save that fails for no visible reason.
 *
 * One vocabulary is deliberately absent: target roles reuse `INTERVIEW_LEVELS`
 * from `lib/types.ts` rather than defining a parallel list, because the whole
 * point of asking is to filter the library by it, and two lists that have to
 * agree eventually don't.
 */

/**
 * The institution this deployment is run for.
 *
 * A constant rather than a question, because the app is launched inside one
 * college: asking sixty people to pick their college from a list of one is
 * ceremony, and printing the same name on every leaderboard row is a column that
 * says nothing. It survives as a constant because the copy still has to name the
 * campus — "your official <name> email address" is the whole check on a password
 * reset.
 *
 * A second campus is a bigger change than editing this line, and deliberately
 * so: it would need the college question, the column and the board row back.
 */
export const INSTITUTION_NAME = "IIM Visakhapatnam";

/**
 * What someone is here as.
 *
 * Two values, because a single-campus launch has two kinds of people in it. The
 * five-way list this replaces ("undergraduate", "working professional", …) was
 * asking a public product's question.
 *
 * **Picking `professor` grants nothing.** It records a request an admin has to
 * approve — see `professorRequestFor` in lib/profile-schema.ts and the Users tab
 * of the admin panel. A role that a dropdown could award itself would let any
 * student open classroom rooms.
 */
export const PROFESSIONS = ["student", "professor"] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const PROFESSION_LABELS: Record<Profession, string> = {
  student: "Student",
  professor: "Professor",
};

export const EXPERIENCE_BANDS = ["0", "0-2", "3-5", "6-10", "10+"] as const;
export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number];

export const EXPERIENCE_LABELS: Record<ExperienceBand, string> = {
  "0": "No work experience yet",
  "0-2": "0–2 years",
  "3-5": "3–5 years",
  "6-10": "6–10 years",
  "10+": "10+ years",
};

/** Free-text caps. Not a security boundary so much as a blast radius. */
export const profileLimits = {
  name: 60,
  phone: 20,
  city: 60,
  bio: 280,
  targetCompanies: 200,
  /** How many interview levels one person may be preparing for at once. */
  targetLevels: 4,
};

/**
 * Avatar constraints, enforced on the server.
 *
 * `dimension` is what the browser resizes to before upload; `maxBytes` is what
 * the server refuses above, and it is deliberately several times the size a
 * 256px JPEG actually comes out at (~30 KB) so an honest PNG from an older
 * browser still fits while a full-resolution photo does not.
 *
 * SVG is absent from `mimes` on purpose — it is a document that can carry
 * script, not an image, and it would be served back from our own origin.
 */
export const avatarLimits = {
  dimension: 256,
  quality: 0.8,
  maxBytes: 512 * 1024,
  mimes: ["image/jpeg", "image/png", "image/webp"] as const,
};

export type AvatarMime = (typeof avatarLimits.mimes)[number];
