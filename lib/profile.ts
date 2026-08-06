/**
 * Reading a profile, and the one rule that decides what it changes.
 *
 * The data access sits here rather than in a page, matching the README's "one
 * data-access module per domain". `prefillLevel` is pure and exported
 * separately so it can be unit-tested — the interesting part of "apply the
 * candidate's goals to the library" is a decision, not a query.
 */

import { db } from "@/lib/db";
import { parseTargetLevels } from "@/lib/profile-schema";
import type { InterviewLevel } from "@/lib/types";

/** A candidate's target interview levels, or an empty list. */
export async function targetLevelsFor(
  userId: string | null | undefined,
): Promise<InterviewLevel[]> {
  if (!userId) return [];
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { targetLevels: true },
  });
  return parseTargetLevels(profile?.targetLevels) as InterviewLevel[];
}

/**
 * Which level, if any, to pre-apply on a bare visit to the library.
 *
 * The subtle part is that `?level=` holds exactly one value — the filter is a
 * single `<select>`, and `listQuestions` takes one level. So a candidate
 * targeting three roles has no URL that expresses them, and picking the first
 * would silently show them a third of what they asked for while claiming to
 * have applied their goals.
 *
 * So: pre-apply only when there is exactly one target and the visitor arrived
 * with no filters at all. Anything else — several targets, an explicit filter,
 * a search — is left alone, and the goals are offered as one-click chips
 * instead. Never overriding a URL someone actually chose is the whole contract
 * here; arriving from the wall banner or a bookmarked filter must not be
 * quietly rewritten.
 */
export function prefillLevel(
  targets: InterviewLevel[],
  params: Record<string, string | undefined>,
): InterviewLevel | null {
  const filtered = ["category", "difficulty", "level", "type", "q", "wall"].some(
    (key) => !!params[key],
  );
  if (filtered) return null;
  return targets.length === 1 ? targets[0] : null;
}
