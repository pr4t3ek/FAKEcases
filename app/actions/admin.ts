"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteWalkthrough, loadWalkthroughFor, saveDraft, setStatus } from "@/lib/walkthrough";
import { parseWalkthrough, walkthroughSchema } from "@/lib/walkthrough/types";
import { validateWalkthrough } from "@/lib/walkthrough/validate";
import { parseJson } from "@/lib/json";
import type { RootCause } from "@/lib/evaluation";
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
import { KEYED_PROVIDERS, type KeyedProvider } from "@/lib/config";
import { decryptSecret, encryptSecret, hasStrongAuthSecret, maskKey } from "@/lib/llm/crypto";
import { clearKeyCache } from "@/lib/llm/keys";
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

/**
 * Open the Arena on one account.
 *
 * Deliberately not a tier and deliberately not a pass. `grantPro` extends a
 * deadline because a pass is a period somebody bought; the Arena is a door an
 * admin opens for a particular person, so the column records WHEN rather than
 * UNTIL and `canPlayArena` tests only for presence.
 *
 * Idempotent on purpose: granting twice must not silently re-date an existing
 * grant, because that timestamp is the only record of when the door was opened.
 */
export async function grantArena(userId: string): Promise<SaveResult> {
  await assertAdmin();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { arenaGrantedAt: true },
  });
  if (!user) return { ok: false, error: "No such user." };
  if (user.arenaGrantedAt) return { ok: true };

  await db.user.update({ where: { id: userId }, data: { arenaGrantedAt: new Date() } });
  revalidatePath("/admin");
  // The nav renders the link off this, so every surface carrying the header has
  // to re-render for the person whose access just changed.
  revalidatePath("/dashboard");
  revalidatePath("/arena");
  return { ok: true };
}

export async function revokeArena(userId: string): Promise<SaveResult> {
  await assertAdmin();
  await db.user.update({ where: { id: userId }, data: { arenaGrantedAt: null } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/arena");
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
/**
 * Save a worked example as a DRAFT.
 *
 * Always a draft, even when an admin edits one that is already live. Saving
 * must never be the action that puts content in front of a student — an edit
 * that went straight out under the previous approval is exactly how a
 * half-finished sentence reaches a beginner.
 */
export async function saveWalkthroughDraft(
  questionId: string,
  content: unknown,
): Promise<SaveResult> {
  await assertAdmin();

  const parsed = walkthroughSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await saveDraft({ questionId, content: parsed.data, source: "admin" });
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Publish, if the arithmetic holds.
 *
 * The validator is the gate and this is the only door through it. A walkthrough
 * whose chain misses its own question's authored range — or, for a case, whose
 * tree skips a scored branch or never reaches the declared cause — would teach a
 * wrong method to the one audience least able to notice. So the refusal is here,
 * where somebody is looking, rather than as a warning nobody has to read.
 */
export async function publishWalkthrough(questionId: string): Promise<SaveResult> {
  await assertAdmin();

  const row = await loadWalkthroughFor(questionId);
  if (!row) return { ok: false, error: "No walkthrough to publish." };

  const content = parseWalkthrough(row.stepsJson);
  const check = validateWalkthrough(content, {
    idealLow: row.question.idealLow,
    idealHigh: row.question.idealHigh,
    expectedBuckets: parseJson<string[]>(row.question.expectedBuckets) ?? [],
    rootCause: parseJson<RootCause>(row.question.rootCause),
  });
  if (!check.ok) {
    return { ok: false, error: check.issues[0]?.message ?? "This walkthrough does not check out." };
  }

  await setStatus(questionId, "published");
  revalidatePath("/admin");
  revalidatePath("/practice", "layout");
  return { ok: true };
}

/** Pull a published walkthrough back. Students stop seeing it immediately. */
export async function unpublishWalkthrough(questionId: string): Promise<SaveResult> {
  await assertAdmin();
  await setStatus(questionId, "draft");
  revalidatePath("/admin");
  revalidatePath("/practice", "layout");
  return { ok: true };
}

export async function removeWalkthrough(questionId: string): Promise<SaveResult> {
  await assertAdmin();
  await deleteWalkthrough(questionId);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Which question a first-timer is walked through.
 *
 * Accepts an `externalId` and checks it resolves, because a typo here does not
 * fail loudly — it silently turns the feature off for every new student, and
 * nobody would notice for weeks.
 */
export async function setWalkthroughDemo(externalId: string): Promise<SaveResult> {
  await assertAdmin();

  const trimmed = externalId.trim();
  if (trimmed) {
    const question = await db.question.findUnique({
      where: { externalId: trimmed },
      select: { id: true },
    });
    if (!question) return { ok: false, error: `No question with the id "${trimmed}".` };
  }

  await saveTextSetting("walkthroughDemoQuestion", trimmed);
  revalidatePath("/admin");
  revalidatePath("/practice", "layout");
  return { ok: true };
}

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

// ── LLM key rotation ────────────────────────────────────────────────────────

/**
 * The keys a provider tries, in order, editable without a redeploy.
 *
 * The reason these are editable at all is the free tier: Gemini's ceiling is per
 * key and shared by every user of the deployment, so a cohort exhausts one key
 * mid-afternoon and everybody after that gets the offline mock. Adding the
 * second key has to be something a professor can do between lectures, which is
 * the same argument `updateLimit` makes for the turn budgets.
 *
 * Rows here OVERRIDE the numbered environment variables entirely — see the note
 * in `lib/llm/keys.ts` on why they do not merge.
 */

/** Refused, rather than stored weakly, when there is nothing safe to encrypt under. */
const NO_SECRET_ERROR =
  "Set AUTH_SECRET to a strong value before storing API keys — the shipped default is public, " +
  "so keys encrypted under it would not really be protected.";

function assertProvider(provider: string): provider is KeyedProvider {
  return (KEYED_PROVIDERS as readonly string[]).includes(provider);
}

/**
 * Add one key to the end of a provider's rotation.
 *
 * The plaintext reaches this action, is encrypted, and is never read back: only
 * `hint` (first and last four characters) is ever returned to a browser.
 */
export async function addLlmKey(provider: string, secret: string): Promise<SaveResult> {
  await assertAdmin();

  if (!assertProvider(provider)) return { ok: false, error: "Unknown provider." };
  if (!hasStrongAuthSecret()) return { ok: false, error: NO_SECRET_ERROR };

  const trimmed = secret.trim();
  if (trimmed.length < 16) {
    return { ok: false, error: "That doesn't look like an API key." };
  }

  // A key pasted twice is not a second key — it is the same quota, tried twice,
  // for one extra failed request per turn.
  //
  // Compared as PLAINTEXT, which needs a decrypt per row and is still the only
  // correct way to do it. The ciphertext differs per row (fresh IV), so equal
  // secrets never compare equal; and the hint is first-and-last-four, which two
  // genuinely different keys from the same provider can easily share — every
  // Google key opens `AIza`. Matching on the hint would reject a real second key
  // as a duplicate, which is exactly the case this feature exists to allow.
  const existing = await db.llmApiKey.findMany({ where: { provider }, select: { secret: true } });
  if (existing.some((row) => decryptSecret(row.secret) === trimmed)) {
    return { ok: false, error: "That key is already in the rotation." };
  }

  const last = await db.llmApiKey.findFirst({
    where: { provider },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.llmApiKey.create({
    data: {
      provider,
      hint: maskKey(trimmed),
      secret: encryptSecret(trimmed),
      order: (last?.order ?? -1) + 1,
    },
  });

  clearKeyCache();
  revalidatePath("/admin");
  return { ok: true };
}

/** Drop a key from the rotation for good. The provider's own console revokes it. */
export async function removeLlmKey(id: string): Promise<SaveResult> {
  await assertAdmin();

  const existing = await db.llmApiKey.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That key is already gone." };

  await db.llmApiKey.delete({ where: { id } });

  clearKeyCache();
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Move a key up or down the rotation.
 *
 * Order is worth controlling because the keys are rarely equivalent: a paid key
 * behind two free ones should be the one that only gets used once the free
 * quota is gone, and that is entirely a question of position.
 */
export async function reorderLlmKey(id: string, direction: "up" | "down"): Promise<SaveResult> {
  await assertAdmin();

  const key = await db.llmApiKey.findUnique({ where: { id } });
  if (!key) return { ok: false, error: "That key is already gone." };

  const neighbour = await db.llmApiKey.findFirst({
    where: {
      provider: key.provider,
      order: direction === "up" ? { lt: key.order } : { gt: key.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return { ok: true };

  // Swapped in one transaction: a half-applied swap leaves two keys claiming the
  // same position, which `listKeys` would then order by `createdAt` — a silent
  // reshuffle of a list the admin was in the middle of arranging.
  await db.$transaction([
    db.llmApiKey.update({ where: { id: key.id }, data: { order: neighbour.order } }),
    db.llmApiKey.update({ where: { id: neighbour.id }, data: { order: key.order } }),
  ]);

  clearKeyCache();
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Put a spent or rejected key back into the rotation.
 *
 * For the two cases that resolve outside this app: credits topped up, or a key
 * rotated in the provider's console under the same name. Clears `lastError`
 * along with the flags, so a key that fails again reports why it failed THIS
 * time rather than showing last month's reason.
 */
export async function reviveLlmKey(id: string): Promise<SaveResult> {
  await assertAdmin();

  const existing = await db.llmApiKey.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That key is already gone." };

  await db.llmApiKey.update({
    where: { id },
    data: { disabled: false, spentOn: null, lastError: null },
  });

  clearKeyCache();
  revalidatePath("/admin");
  return { ok: true };
}
