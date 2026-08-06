"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validateAvatarDataUri } from "@/lib/avatar";
import { getAvatarStore } from "@/lib/storage";
import {
  onboardingSchema,
  profileSchema,
  toProfileColumns,
} from "@/lib/profile-schema";

export interface SaveResult {
  ok: boolean;
  /** The first validation failure, phrased for the person who hit it. */
  error?: string;
}

/**
 * Validation failures are *returned*, not thrown — the same reasoning as
 * `app/actions/admin.ts`. Next redacts a thrown Server Action error in
 * production, so a throw reaches the user as "an error occurred" when the real
 * problem is "that image is too large" and the fix is one click. Only being
 * signed out still throws.
 */
function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Save failed.";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

/**
 * The signed-in, non-guest user, or null.
 *
 * A guest has nowhere to put a profile — the row is absorbed or discarded when
 * they sign up — so every action here refuses one rather than writing state
 * that is about to be thrown away.
 */
async function member() {
  const user = await getSessionUser();
  if (!user || user.isGuest) return null;
  return user;
}

function refreshProfileSurfaces() {
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

/**
 * Marks the first-run tutorial on the PRACTICE screen as seen.
 *
 * Unchanged, and deliberately not merged with `completeOnboarding` below: the
 * two record different events, and one column for both would suppress the
 * practice tutorial for anyone who filled in their profile first.
 */
export async function markOnboarded(): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.onboardedAt) return;
  await db.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
}

export async function updateProfile(input: unknown): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { user: userColumns, profile } = toProfileColumns(parsed.data);

  // One transaction: a saved name with an unsaved college is a profile that
  // disagrees with itself, and the user has no way to tell which half landed.
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: userColumns }),
    db.profile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    }),
  ]);

  refreshProfileSurfaces();
  return { ok: true };
}

/**
 * Save the post-signup answers, or record that they were skipped.
 *
 * Both paths set `profileCompletedAt`, because the flag means "has been asked",
 * not "has answered". Re-prompting someone who deliberately skipped is the one
 * behaviour that would make the step feel mandatory when it isn't.
 */
export async function completeOnboarding(input: unknown): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { user: userColumns, profile } = toProfileColumns(parsed.data);

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { ...userColumns, profileCompletedAt: new Date() },
    }),
    db.profile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    }),
  ]);

  refreshProfileSurfaces();
  revalidatePath("/library");
  return { ok: true };
}

/** Dismiss the questions without answering them. */
export async function skipOnboarding(): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };
  if (user.profileCompletedAt) return { ok: true };

  await db.user.update({
    where: { id: user.id },
    data: { profileCompletedAt: new Date() },
  });
  refreshProfileSurfaces();
  return { ok: true };
}

/**
 * Store a new avatar.
 *
 * The data URI arrives already resized by the browser, and none of that is
 * trusted: `validateAvatarDataUri` reads the mime out of the payload and
 * refuses anything oversized before decoding it.
 */
export async function uploadAvatar(dataUri: unknown): Promise<SaveResult & { url?: string }> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const checked = validateAvatarDataUri(dataUri);
  if (!checked.ok) return { ok: false, error: checked.error };

  const url = await getAvatarStore().put(user.id, checked.bytes, checked.mime);
  await db.user.update({ where: { id: user.id }, data: { image: url } });

  // The header renders on every page, so the avatar has to be re-fetched
  // everywhere rather than only where it was changed.
  revalidatePath("/", "layout");
  return { ok: true, url };
}

export async function removeAvatar(): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };

  await getAvatarStore().remove(user.id);
  await db.user.update({ where: { id: user.id }, data: { image: null } });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The password rules, matching what signup already enforces inline in
 * `lib/auth.ts`. Kept as a schema so the message names the field.
 */
const passwordChangeSchema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string().min(6, "Use at least 6 characters"),
});

/**
 * Change the password.
 *
 * Worth knowing, and documented in the README's known limitations: this cannot
 * sign anyone out. `verify()` in `lib/auth.ts` ignores the timestamp inside the
 * session token and there is no revocation list, so a session opened on another
 * device stays valid until its cookie expires. Saying so is better than
 * implying a security property the app doesn't have.
 */
export async function changePassword(input: unknown): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  if (!user.passwordHash) {
    return { ok: false, error: "This account doesn't have a password set." };
  }
  if (!verifyPassword(parsed.data.current, user.passwordHash)) {
    return { ok: false, error: "That current password isn't right." };
  }
  if (parsed.data.current === parsed.data.next) {
    return { ok: false, error: "That's the password you already have." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.next) },
  });
  return { ok: true };
}
