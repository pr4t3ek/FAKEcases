"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearSession, getSessionUser } from "@/lib/auth";
import { deleteAccount as deleteAccountRows } from "@/lib/account-deletion";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validateAvatarDataUri } from "@/lib/avatar";
import { getAvatarStore } from "@/lib/storage";
import {
  onboardingSchema,
  professorRequestFor,
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
  // Picking "Professor" records a request; it NEVER writes `role`. See
  // `professorRequestFor` — a dropdown that granted the role would hand any
  // student the classroom console and the roster behind it.
  const requested = professorRequestFor(
    parsed.data.profession,
    user.role,
    user.professorRequestedAt,
  );

  // One transaction: a saved name with an unsaved batch is a profile that
  // disagrees with itself, and the user has no way to tell which half landed.
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { ...userColumns, ...(requested !== undefined ? { professorRequestedAt: requested } : {}) },
    }),
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
  // Same rule as `updateProfile`, and it has to be applied in both places
  // rather than in one shared write path: the two actions save different
  // subsets, and this is the field they both carry.
  const requested = professorRequestFor(
    parsed.data.profession,
    user.role,
    user.professorRequestedAt,
  );

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        ...userColumns,
        profileCompletedAt: new Date(),
        ...(requested !== undefined ? { professorRequestedAt: requested } : {}),
      },
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

/**
 * Dismiss the questions without answering them.
 *
 * **Except the batch.** Everything this step asks is optional and always has
 * been, but a board row now carries a batch, and one that skips the question
 * leaves a row nobody can read. So the skip refuses while `batch` is null
 * rather than pretending to succeed — the button that calls this is hidden in
 * the same state, and this is what stops a hand-rolled POST walking past it.
 */
export async function skipOnboarding(): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };
  if (!user.batch) return { ok: false, error: "Choose your batch first." };
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

/** The same rule without the current-password half. See `completeForcedPasswordChange`. */
const forcedPasswordSchema = passwordChangeSchema.pick({ next: true });

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
    // Clears the forced-change flag too: someone who arrived here from an admin
    // reset and used the ordinary form has done exactly what the flag was
    // asking for, and leaving it set would send them to `/set-password` to do
    // it again.
    data: { passwordHash: hashPassword(parsed.data.next), mustChangePassword: false },
  });
  return { ok: true };
}

/**
 * Choose a password after an admin reset.
 *
 * No current-password field, and that is not a hole: the current password is the
 * account's own email address, which the admin just told them and which
 * `requirePasswordChange` treats as good for exactly one thing — reaching this
 * form. Asking someone to retype a password they were handed thirty seconds ago
 * verifies nothing; the session cookie is what proves who they are here, the
 * same as it does for `changePassword`.
 *
 * **Refuses when the flag is not set**, so this is never a way to change a
 * password without knowing the old one. Outside a reset, `changePassword` — and
 * its current-password check — is the only route.
 */
export async function completeForcedPasswordChange(input: unknown): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };
  if (!user.mustChangePassword) {
    return { ok: false, error: "Your password doesn't need changing." };
  }

  const parsed = forcedPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // The reset made the email the password, so accepting it back would leave the
  // account exactly as guessable as the gate exists to stop it being.
  if (user.email && parsed.data.next.toLowerCase() === user.email.toLowerCase()) {
    return { ok: false, error: "Pick something other than your email address." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.next), mustChangePassword: false },
  });
  return { ok: true };
}

/**
 * Typing your own email address is the confirmation.
 *
 * Not a password, deliberately: this account may not have one (`passwordHash` is
 * nullable and `changePassword` already has to say so), and an irreversible
 * action wants a step that cannot be completed by muscle memory. Typing out the
 * address is that step.
 */
const deleteAccountSchema = z.object({
  confirmEmail: z.string().min(1, "Type your email address to confirm"),
});

/**
 * Delete your own account.
 *
 * What survives is `lib/account-deletion.ts`'s business, and the card on
 * `/profile` says so in as many words: everything personal goes, and classroom
 * seats and results stay behind anonymously so a professor's roster does not
 * develop holes weeks after the class.
 *
 * Guests are refused by `member()` like every other action here, and for a
 * sharper reason than usual — a guest row is absorbed at signup or deleted at
 * login, so "delete my account" is something the app already does to them.
 */
export async function deleteAccount(input: unknown): Promise<SaveResult> {
  const user = await member();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // The same normalisation `signup` and `login` apply, so an address that signs
  // in confirms a deletion — trimmed and lowercased, or a capitalised autofill
  // would refuse the person who typed it correctly.
  const typed = parsed.data.confirmEmail.trim().toLowerCase();
  if (!user.email || typed !== user.email) {
    return { ok: false, error: "That doesn't match the email on this account." };
  }

  // Deleting the last admin leaves nobody who can reach /admin — the same
  // lock-yourself-out reasoning `setUserRole` gives for refusing self-demotion,
  // except there is no undoing this one.
  if (user.role === "admin") {
    const admins = await db.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return {
        ok: false,
        error: "You're the only admin. Make someone else an admin first.",
      };
    }
  }

  await deleteAccountRows(user.id);

  // Order matters: `clearSession` writes a cookie and `redirect` throws to
  // unwind, so the cookie has to be gone before the throw. Same destination as
  // `logoutAction` — there is no account to go back to.
  await clearSession();
  redirect("/");
}
