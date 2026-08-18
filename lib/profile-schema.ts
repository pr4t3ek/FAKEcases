/**
 * The authoring contract for a person's own profile.
 *
 * Lives apart from the server action that uses it so it can be unit-tested like
 * the rest of the rule functions — the action imports `server-only`
 * transitively and can't be pulled into a test. Same arrangement, and the same
 * reasons, as `lib/question-schema.ts`.
 *
 * Two callers share it: the profile page, which submits everything, and the
 * post-signup step, which submits a subset. They extend one core rather than
 * declaring two shapes, because a field that validates one way on `/welcome`
 * and another way on `/profile` is a field someone will eventually get past.
 */

import { z } from "zod";
import { BATCH_IDS } from "@/lib/config/batches";
import { EXPERIENCE_BANDS, PROFESSIONS, profileLimits } from "@/lib/config";
import { INTERVIEW_LEVELS } from "@/lib/types";

const blank = (v: unknown) => v === "" || v === null || v === undefined;

/**
 * Text that may legitimately be absent, trimmed and capped.
 *
 * Blank collapses to `""` here and to `null` in `toProfileColumns`, so clearing
 * a field actually clears it instead of storing an empty string that renders as
 * a mysteriously blank line.
 */
const optionalText = (max: number) =>
  z.preprocess((v) => (blank(v) ? "" : v), z.string().trim().max(max).default(""));

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (blank(v) ? undefined : v), z.enum(values).optional());

/**
 * Indian mobile numbers, loosely.
 *
 * Deliberately permissive: digits, spaces, hyphens and an optional country
 * code. Nothing dials it, so a strict pattern would only reject people with an
 * unusual but real number to no benefit at all.
 */
const optionalPhone = z.preprocess(
  (v) => (blank(v) ? "" : v),
  z
    .string()
    .trim()
    .max(profileLimits.phone)
    .refine((v) => v === "" || /^[+]?[\d][\d\s-]{6,}$/.test(v), "That doesn't look like a phone number")
    .default(""),
);

/** `["McKinsey","PM"]` from checkboxes, or a `|`-joined line from a form post. */
const levelList = z.preprocess(
  (v) => {
    if (blank(v)) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "string") return v.split("|").map((s) => s.trim()).filter(Boolean);
    return v;
  },
  z
    .array(z.enum(INTERVIEW_LEVELS))
    .max(profileLimits.targetLevels, `Pick at most ${profileLimits.targetLevels}`)
    .default([]),
);

export const profileCoreSchema = z.object({
  name: z.string().trim().min(1, "Your name can't be empty").max(profileLimits.name),
  phone: optionalPhone,
  city: optionalText(profileLimits.city),
  bio: optionalText(profileLimits.bio),

  profession: optionalEnum(PROFESSIONS),
  /**
   * Which PGP batch. **The one required field besides the name.**
   *
   * Not `optionalEnum` like its neighbours, and that is the whole point: every
   * board row shows a batch, so a blank one is a row that cannot be read.
   *
   * One `errorMap` rather than `required_error` + `invalid_type_error`, because
   * an unanswered select posts `""`, which zod reports as `invalid_enum_value`
   * — covered by neither of those, and it defaults to "Invalid enum value.
   * Expected 'pgp1' | 'pgp2'", which is not a sentence to show someone who
   * simply has not picked yet.
   */
  batch: z.enum(BATCH_IDS, { errorMap: () => ({ message: "Choose your batch" }) }),
  experience: optionalEnum(EXPERIENCE_BANDS),

  targetLevels: levelList,
  targetCompanies: optionalText(profileLimits.targetCompanies),
});

export type ProfileCore = z.infer<typeof profileCoreSchema>;

/**
 * The full profile.
 *
 * An alias of the core rather than a `superRefine` on top of it: the only
 * cross-field rule this schema ever had was the college one ("Other" needs a
 * written-in name), and the college question is gone — one campus, so
 * `INSTITUTION_NAME` is a constant and nobody is asked. The alias stays so every
 * call site keeps naming the thing it validates against.
 */
export const profileSchema = profileCoreSchema;

/**
 * The subset the post-signup step asks for.
 *
 * `name` is already set at signup, so the step doesn't re-ask. Everything here
 * is optional except `batch`, which the core schema requires — and that is what
 * makes this step no longer entirely skippable. See `requireBatch` in
 * lib/batch-gate.ts for the redirect that enforces the same rule from the other
 * side; this is the half that stops a hand-rolled POST getting past it.
 */
export const onboardingSchema = profileCoreSchema.pick({
  profession: true,
  batch: true,
  targetLevels: true,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Split validated input into the two rows it lands in.
 *
 * `batch` goes to `User` because a board groups by it; everything else goes to
 * `Profile` because it is only ever displayed. The split is by access pattern,
 * not by how "profile-ish" a field feels — the same rule the schema comment on
 * `model Profile` states.
 */
export function toProfileColumns(data: Partial<ProfileCore>) {
  const user: { name?: string; batch?: string } = {};
  if (data.name !== undefined) user.name = data.name;
  if (data.batch !== undefined) user.batch = data.batch;

  const profile: Record<string, string | number | null> = {};
  const put = (key: string, value: string | undefined) => {
    if (value !== undefined) profile[key] = value || null;
  };

  put("phone", data.phone);
  put("city", data.city);
  put("bio", data.bio);
  put("profession", data.profession);
  put("experience", data.experience);
  put("targetCompanies", data.targetCompanies);
  if (data.targetLevels !== undefined) profile.targetLevels = JSON.stringify(data.targetLevels);

  return { user, profile };
}

/**
 * What saying "I'm a professor" on the profile does to the account.
 *
 * **Never the role.** It writes `User.professorRequestedAt`, a request an admin
 * approves from the Users tab; the occupation itself is display text. A dropdown
 * that granted the role would let any student open classroom rooms and read a
 * roster of names, emails and scores.
 *
 * Pure, and separate from the action that writes it, so the rule can be tested
 * without a database — the same arrangement as everything else in this file.
 *
 * Returns `undefined` when the column should be left exactly as it is, which is
 * not the same as `null`:
 *
 *   - Already a professor or an admin: there is nothing to ask for. This is what
 *     stops an admin editing their own profile from queueing themselves up in
 *     their own approval list.
 *   - Occupation left blank: they did not answer, which is not a withdrawal — a
 *     partial save must not silently cancel a request they are waiting on.
 *   - Asking again while a request is already pending: keep the original stamp,
 *     so the queue stays ordered by when people actually asked.
 */
export function professorRequestFor(
  profession: string | undefined,
  role: string,
  existing: Date | null,
  now: Date = new Date(),
): Date | null | undefined {
  if (role !== "user") return undefined;
  if (!profession) return undefined;
  if (profession !== "professor") return existing ? null : undefined;
  return existing ?? now;
}

/** Read the stored JSON back, tolerating anything that isn't a level list. */
export function parseTargetLevels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is string => typeof v === "string" && (INTERVIEW_LEVELS as readonly string[]).includes(v),
    );
  } catch {
    return [];
  }
}
