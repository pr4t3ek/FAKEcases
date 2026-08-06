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
import { COLLEGE_OTHER, isKnownCollege } from "@/lib/config/colleges";
import {
  EXPERIENCE_BANDS,
  PROFESSIONS,
  gradYearRange,
  profileLimits,
} from "@/lib/config";
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

/**
 * A year that may be absent.
 *
 * `z.coerce.number()` turns `""` into `0`, which is exactly how a blank field
 * became a real value elsewhere in this codebase (see the ideal-range bug in
 * `lib/question-schema.ts`). Blanks are mapped to undefined first.
 */
const optionalYear = z.preprocess(
  (v) => (blank(v) ? undefined : v),
  z.coerce
    .number()
    .int()
    .min(gradYearRange.min, `Graduation year must be ${gradYearRange.min} or later`)
    .max(gradYearRange.max, `Graduation year must be ${gradYearRange.max} or earlier`)
    .optional(),
);

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
  /** A curated id, `COLLEGE_OTHER`, or blank. Checked in `refineProfile`. */
  collegeId: optionalText(64),
  collegeOther: optionalText(profileLimits.collegeOther),
  gradYear: optionalYear,
  experience: optionalEnum(EXPERIENCE_BANDS),

  targetLevels: levelList,
  targetCompanies: optionalText(profileLimits.targetCompanies),
});

export type ProfileCore = z.infer<typeof profileCoreSchema>;

/**
 * Cross-field rules, exported so both callers apply exactly the same ones.
 */
export function refineProfile(data: ProfileCore, ctx: z.RefinementCtx): void {
  const at = (path: keyof ProfileCore, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (!data.collegeId) {
    // Nothing chosen. A written-in name with no "Other" selected is a form bug
    // rather than a save — dropping it silently would lose what they typed.
    if (data.collegeOther) at("collegeId", "Choose “Other” to write in a college");
    return;
  }

  if (data.collegeId === COLLEGE_OTHER) {
    if (!data.collegeOther) at("collegeOther", "Write in the name of your college");
    return;
  }

  if (!isKnownCollege(data.collegeId)) {
    at("collegeId", "That college isn't on the list");
  }
}

export const profileSchema = profileCoreSchema.superRefine(refineProfile);

/**
 * The subset the post-signup step asks for.
 *
 * `name` is already set at signup, so the step doesn't re-ask; everything else
 * is optional, because the whole flow is skippable and a half-answered step
 * must still save.
 */
export const onboardingSchema = profileCoreSchema
  .pick({
    profession: true,
    collegeId: true,
    collegeOther: true,
    gradYear: true,
    targetLevels: true,
  })
  .superRefine((data, ctx) =>
    refineProfile({ ...emptyProfile(), ...data } as ProfileCore, ctx),
  );

export type OnboardingInput = z.infer<typeof onboardingSchema>;

function emptyProfile(): ProfileCore {
  return {
    name: "placeholder",
    phone: "",
    city: "",
    bio: "",
    profession: undefined,
    collegeId: "",
    collegeOther: "",
    gradYear: undefined,
    experience: undefined,
    targetLevels: [],
    targetCompanies: "",
  };
}

/**
 * Split validated input into the two rows it lands in.
 *
 * `collegeId` goes to `User` because it is grouped by; everything else goes to
 * `Profile` because it is only ever displayed. `COLLEGE_OTHER` is a form value,
 * not a stored one — it becomes a null id plus the written-in name, which is
 * what makes "has a real college" a single `collegeId != null` check rather
 * than a string comparison every reader has to remember.
 */
export function toProfileColumns(data: Partial<ProfileCore>) {
  const chose = data.collegeId ?? "";
  const other = chose === COLLEGE_OTHER;

  const user: { name?: string; collegeId?: string | null } = {};
  if (data.name !== undefined) user.name = data.name;
  if (data.collegeId !== undefined) user.collegeId = other || !chose ? null : chose;

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
  if (data.collegeId !== undefined) profile.collegeOther = other ? data.collegeOther || null : null;
  if (data.gradYear !== undefined) profile.gradYear = data.gradYear ?? null;
  if (data.targetLevels !== undefined) profile.targetLevels = JSON.stringify(data.targetLevels);

  return { user, profile };
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
