"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { deleteAccount } from "@/lib/account-deletion";
import { DAILY_SLOTS, pinDaily, unpinDaily, type DailySlot } from "@/lib/daily-unlock";
import {
  SETTING_DEFAULTS,
  saveSetting,
  saveTextSetting,
  type SettingKey,
} from "@/lib/settings";
import { PRO_PASS_DAYS, nextProUntil } from "@/lib/billing";
import { FEEDBACK_STATUSES, USER_ROLES, isUserRole } from "@/lib/types";
import { isRealUser } from "@/lib/user-segment";
import {
  questionCoreSchema,
  refineQuestion,
  toQuestionColumns,
} from "@/lib/question-schema";

async function assertAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Forbidden");
}

/** The shared authoring contract, plus the category as the admin form names it. */
const questionSchema = questionCoreSchema
  .extend({ categoryId: z.string().min(1) })
  .superRefine(refineQuestion);

export interface SaveResult {
  ok: boolean;
  /** The first validation failure, phrased for the author. */
  error?: string;
}

/**
 * Validation failures are *returned*, not thrown.
 *
 * Next redacts a thrown Server Action error in production, so a throw would
 * reach the admin as "an error occurred" — useless when the actual problem is
 * "rootCause must be valid JSON" and the fix is one character. Only genuinely
 * exceptional things (not an admin, database down) still throw.
 */
function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Save failed.";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

export async function createQuestion(input: unknown): Promise<SaveResult> {
  await assertAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await db.question.create({
    data: {
      ...toQuestionColumns(parsed.data),
      categoryId: parsed.data.categoryId,
      source: "admin",
    },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
  return { ok: true };
}

export async function updateQuestion(id: string, input: unknown): Promise<SaveResult> {
  await assertAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await db.question.update({
    where: { id },
    data: { ...toQuestionColumns(parsed.data), categoryId: parsed.data.categoryId },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
  return { ok: true };
}

export async function deleteQuestion(id: string) {
  await assertAdmin();
  await db.question.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/library");
}

/**
 * Give a question away to guests, or take it back.
 *
 * Its own action rather than a field on `questionSchema`, because this is a
 * merchandising decision and that schema is an authoring contract. Folding the
 * two together would put `freeTier` into `toQuestionColumns`, and every edit
 * through the form and every CSV re-import would then reset the flag to
 * whatever the payload happened to carry — quietly relocking the shop window.
 *
 * It is also the only control that works on a simulation, whose catalogue row
 * the question form deliberately refuses to edit.
 */
export async function setQuestionFreeTier(id: string, freeTier: boolean): Promise<SaveResult> {
  await assertAdmin();
  await db.question.update({ where: { id }, data: { freeTier } });
  revalidatePath("/admin");
  revalidatePath("/library");
  return { ok: true };
}

/**
 * Give someone a Pro pass, or take it back.
 *
 * **This is the seam a payment gateway will call.** When checkout lands, the
 * webhook's job is to verify a signature and then do exactly this — which is
 * why the entitlement half of freemium is complete and testable before any
 * money moves, and why an admin grant is not a stopgap. Support, comps and
 * refunds need it permanently, and it is what keeps the app usable with no
 * gateway configured, the same way the mock interviewer keeps it usable with no
 * LLM key.
 *
 * Extending rather than resetting is `nextProUntil`'s job — see the note there.
 */
export async function grantPro(userId: string, days: number): Promise<SaveResult> {
  await assertAdmin();

  if (!PRO_PASS_DAYS.includes(days as (typeof PRO_PASS_DAYS)[number])) {
    return { ok: false, error: `A pass is ${PRO_PASS_DAYS.join(" or ")} days.` };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { proUntil: true } });
  if (!user) return { ok: false, error: "No such user." };

  await db.user.update({
    where: { id: userId },
    data: { proUntil: nextProUntil(user.proUntil, days) },
  });
  revalidatePath("/admin");
  // The tier decides what the library and the dashboard show, so both have to
  // re-render for the person whose access just changed.
  revalidatePath("/library");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}

export async function revokePro(userId: string): Promise<SaveResult> {
  await assertAdmin();
  await db.user.update({ where: { id: userId }, data: { proUntil: null } });
  revalidatePath("/admin");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}

/**
 * Make someone a professor, or take it back.
 *
 * Its own action rather than a field on a general user form, for the same reason
 * `setQuestionFreeTier` is its own action: this is a trust decision, and folding
 * it into a save that also carries unrelated fields is how an unrelated edit
 * silently resets it.
 *
 * It deliberately does NOT also grant Pro. `createRoom` gates on the *host's own*
 * tier, so a free-tier professor can host only the free war rooms — see the note
 * there. Handing every new professor the paid catalogue for sixty students is a
 * commercial decision, not a side effect of a role, so the two grants stay two
 * buttons sitting next to each other.
 */
export async function setUserRole(userId: string, role: string): Promise<SaveResult> {
  await assertAdmin();

  if (!isUserRole(role)) {
    return { ok: false, error: `Role must be one of ${USER_ROLES.join(", ")}.` };
  }

  const self = await getSessionUser();
  // Demoting yourself locks you out of the only screen that could undo it.
  if (self?.id === userId && role !== "admin") {
    return { ok: false, error: "You can't remove your own admin role." };
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { isGuest: true },
  });
  if (!target) return { ok: false, error: "No such user." };
  // A guest row is absorbed at signup or deleted at login, so a role granted to
  // one is a grant that evaporates without saying so.
  if (target.isGuest) return { ok: false, error: "Guests can't hold a role." };

  await db.user.update({
    where: { id: userId },
    // A decision on the role settles any request that was pending, whichever way
    // it went: granting it answers the ask, and taking it back answers a fresh
    // one made by someone who already holds it. A stamp left behind would sit in
    // the queue forever, since nothing else clears it.
    data: { role, professorRequestedAt: null },
  });
  revalidatePath("/admin");
  // The nav's Host link and the catalogue's "Host this in class" control are
  // both keyed off the role, so both have to re-render for the person whose
  // role just changed.
  revalidatePath("/simulations");
  revalidatePath("/host");
  return { ok: true };
}

/**
 * Turn down a professor request without granting anything.
 *
 * The counterpart to `setUserRole("professor")`, and the reason the request is
 * a column rather than an inference off the profile's occupation field: a "no"
 * has to be recordable. Without this, declining would mean either leaving the
 * row in the queue forever or asking the person to edit their own profile back.
 *
 * Their occupation is left exactly as they wrote it. It is display text about
 * who they are, and correcting somebody's self-description because you turned
 * down their access request is not the admin's business.
 */
export async function declineProfessorRequest(userId: string): Promise<SaveResult> {
  await assertAdmin();

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { professorRequestedAt: true },
  });
  if (!target) return { ok: false, error: "No such user." };
  if (!target.professorRequestedAt) return { ok: true };

  await db.user.update({ where: { id: userId }, data: { professorRequestedAt: null } });
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Reset someone's password to their own email address.
 *
 * The whole reset flow, since no email provider is configured: a student writes
 * in from their college address, an admin clicks this, and the admin replies
 * telling them to sign in with their email as the password.
 *
 * **The new password is guessable by design**, so it is paired with
 * `mustChangePassword`: `requirePasswordChange` (lib/password-gate.ts) then lets
 * that account reach `/set-password` and nothing else until it picks a real one.
 * Setting one without the other would leave an account whose password is public
 * knowledge open for as long as the person did not get round to changing it.
 *
 * Returns the email so the panel's toast can state what the password now is —
 * the admin has to type it into a reply, and making them go and look it up is
 * how they end up sending the wrong one.
 */
export async function resetUserPassword(
  userId: string,
): Promise<SaveResult & { password?: string }> {
  await assertAdmin();

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isGuest: true, passwordHash: true },
  });
  if (!target) return { ok: false, error: "No such user." };
  // Both of these are accounts nobody signs in to: a guest has no credentials at
  // all, and a row with no email has nothing to set the password to and no
  // address to tell.
  if (target.isGuest || !target.email) {
    return { ok: false, error: "That account can't sign in with a password." };
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(target.email), mustChangePassword: true },
  });
  revalidatePath("/admin");
  return { ok: true, password: target.email };
}

/**
 * Delete a user's account on their behalf.
 *
 * Returns its refusals rather than throwing like `deleteQuestion` next door: each
 * one is a sentence an admin needs to read and act on, and a thrown Server Action
 * error reaches them redacted in production.
 *
 * The target's email is typed to confirm, for the same reason it is on
 * `/profile` — except here the mis-click being guarded against is a row on a
 * table of hundreds, which is the more likely of the two.
 */
export async function deleteUser(userId: string, confirmEmail: string): Promise<SaveResult> {
  await assertAdmin();

  const self = await getSessionUser();
  // Not a capability question — an admin may certainly delete their own account.
  // But doing it from this table skips the last-admin check and the session
  // teardown that `/profile` does, so it is refused with somewhere to go.
  if (self?.id === userId) {
    return { ok: false, error: "Delete your own account from your profile page." };
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isGuest: true, role: true },
  });
  if (!target) return { ok: false, error: "No such user." };

  // The 40 seeded rows exist to give the percentile rank a cold-start
  // population; deleting them shrinks it and moves everyone's percentile for no
  // reason a support request ever asked for.
  if (!isRealUser(target)) {
    return { ok: false, error: "Benchmark rows seed the rank population and can't be deleted." };
  }

  if (target.role === "admin") {
    const admins = await db.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return { ok: false, error: "That's the only admin account." };
    }
  }

  // A guest row has no email to type, so the confirmation is the id instead —
  // the table has it and a human does not type a cuid from memory.
  const expected = (target.email ?? userId).toLowerCase();
  if (confirmEmail.trim().toLowerCase() !== expected) {
    return { ok: false, error: "That doesn't match the account you're deleting." };
  }

  await deleteAccount(userId);

  revalidatePath("/admin");
  // Their rows are gone from every board, and a room they hosted is now closed.
  revalidatePath("/dashboard");
  revalidatePath("/host");
  return { ok: true };
}

const categorySchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "lowercase-with-hyphens"),
  name: z.string().min(2),
  icon: z.string().optional().default(""),
});

export async function createCategory(input: unknown) {
  await assertAdmin();
  const data = categorySchema.parse(input);
  const count = await db.category.count();
  await db.category.create({
    data: { slug: data.slug, name: data.name, icon: data.icon || null, order: count + 1 },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
}

export async function setFeedbackStatus(id: string, status: string) {
  await assertAdmin();
  if (!FEEDBACK_STATUSES.includes(status as (typeof FEEDBACK_STATUSES)[number])) {
    throw new Error("Invalid status");
  }
  await db.questionFeedback.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}

// ── The daily unlock ────────────────────────────────────────────────────────

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isSlot(value: string): value is DailySlot {
  return (DAILY_SLOTS as readonly string[]).includes(value);
}

/**
 * Pin a question to a calendar day.
 *
 * Pinning is always OPTIONAL — `lib/daily-unlock.ts` derives a pick from the
 * date when no pin exists, so an admin who sets nothing still has a class with
 * work. This is for the days they care about: the one that follows the lecture,
 * or the one before the exam.
 */
export async function setDailyUnlock(
  day: string,
  slot: string,
  questionId: string,
): Promise<SaveResult> {
  await assertAdmin();

  if (!DAY_PATTERN.test(day)) return { ok: false, error: "Pick a date." };
  if (!isSlot(slot)) return { ok: false, error: "Unknown slot." };

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { type: true },
  });
  if (!question) return { ok: false, error: "No such question." };
  // A war room pinned into the guesstimate slot would unlock, and then confuse
  // everyone about why the day's "guesstimate" opens a four-phase simulation.
  if (question.type !== slot) {
    return { ok: false, error: `That question isn't a ${slot}.` };
  }

  await pinDaily(day, slot, questionId);
  revalidatePath("/admin");
  revalidatePath("/library");
  revalidatePath("/simulations");
  return { ok: true };
}

/** Drop a pin, handing the day back to the automatic rotation. */
export async function clearDailyUnlock(day: string, slot: string): Promise<SaveResult> {
  await assertAdmin();
  if (!isSlot(slot)) return { ok: false, error: "Unknown slot." };

  await unpinDaily(day, slot);
  revalidatePath("/admin");
  revalidatePath("/library");
  revalidatePath("/simulations");
  return { ok: true };
}

// ── Tunable limits ──────────────────────────────────────────────────────────

/**
 * Change one of the turn budgets without a deploy.
 *
 * The reason these are editable at all: a class turns out to need more room than
 * the default allowed, and the alternative is a redeploy between lectures.
 *
 * 0 means "disabled" for every one of them, which is why the floor is 0 rather
 * than 1 — and why the copy in the admin panel has to say so, since a limit of
 * zero reads like "nobody may send anything".
 */
export async function updateLimit(key: string, value: number): Promise<SaveResult> {
  await assertAdmin();

  if (!Object.prototype.hasOwnProperty.call(SETTING_DEFAULTS, key)) {
    return { ok: false, error: "Unknown setting." };
  }
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "Use a whole number, 0 or more." };
  }

  await saveSetting(key as SettingKey, Math.floor(value));
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Change the address `/forgot-password` tells locked-out students to write to.
 *
 * Editable rather than shipped, because it is a person's mailbox: whoever
 * administers this launch is not necessarily whoever administers it next term,
 * and a handover should not be a deploy. The shipped default keeps a fresh
 * clone's instructions from being blank.
 */
export async function updateContactEmail(email: string): Promise<SaveResult> {
  await assertAdmin();

  const parsed = z.string().trim().email("That doesn't look like an email address").safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await saveTextSetting("adminContactEmail", parsed.data);
  revalidatePath("/admin");
  revalidatePath("/forgot-password");
  return { ok: true };
}

// ── Bulk lock ───────────────────────────────────────────────────────────────

/**
 * Lock or unlock the whole catalogue in one action.
 *
 * Forty-six clicks is not a control, it is a chore with a mistake in it — and
 * "lock everything, then let the daily rotation open one a day" is the launch
 * configuration, so it should be one button rather than an afternoon.
 */
export async function setAllFreeTier(freeTier: boolean): Promise<SaveResult> {
  await assertAdmin();

  await db.question.updateMany({ data: { freeTier } });
  revalidatePath("/admin");
  revalidatePath("/library");
  revalidatePath("/simulations");
  return { ok: true };
}
