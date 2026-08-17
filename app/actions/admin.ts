"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { deleteAccount } from "@/lib/account-deletion";
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

  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
  // The nav's Host link and the catalogue's "Host this in class" control are
  // both keyed off the role, so both have to re-render for the person whose
  // role just changed.
  revalidatePath("/simulations");
  revalidatePath("/host");
  return { ok: true };
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
