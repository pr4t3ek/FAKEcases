"use server";

/**
 * Admin control over a scenario's driver graph.
 *
 * The save path is where the guarantees that used to belong to CI now live.
 * Authored-in-code scenarios were checked once by `tests/sim-scenario.test.ts`
 * before they could ship; an admin editing baselines at runtime has no such
 * gate, so every check that suite runs is run here, against the merged scenario,
 * before a row is written:
 *
 *   1. `parseDriversJson` — is it a well-formed `SimDriver[]`?
 *   2. `validateScenario` — do the cross-references still resolve? An edit that
 *      renames a driver an intervention effect targets is caught here.
 *   3. `checkBalance`     — is the authored `bestAllocation` still the best one?
 *      Retuning a baseline can make a decoy intervention win, which would make
 *      every outcome score since that save meaningless.
 *
 * A scenario that fails any of the three is not stored, so the fallback in
 * `lib/sim/overlay.ts` stays a backstop rather than the normal path.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getScenario } from "@/lib/sim/registry";
import { parseDriversJson, withDrivers } from "@/lib/sim/overlay";
import { validateScenario } from "@/lib/sim/validate";
import { checkBalance } from "@/lib/sim/balance";
import type { User } from "@prisma/client";

export interface ScenarioSaveResult {
  ok: boolean;
  /**
   * Every problem, not just the first.
   *
   * Unlike the question form — where `SaveResult` carries one message because
   * the fields are independent — driver edits fail in clusters: renaming one
   * driver breaks every reference to it, and reporting those one save at a time
   * would be its own kind of broken.
   */
  errors?: string[];
}

async function requireAdminUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Forbidden");
  return user;
}

/**
 * Everything wrong with a proposed driver graph, in the author's words.
 *
 * Empty means it is safe to store. Shape failures return alone: the later checks
 * read fields the parse could not confirm exist, so running them would report
 * confusing consequences of a problem already named.
 */
function review(slug: string, driversJson: string): string[] {
  const base = getScenario(slug);
  if (!base) return [`No authored scenario named "${slug}".`];

  const { drivers, error } = parseDriversJson(driversJson);
  if (!drivers) return [error ?? "The driver graph could not be read."];

  const merged = withDrivers(base, drivers);

  const structural = validateScenario(merged);
  if (structural.length) return structural;

  // `fast` because an admin is watching a spinner. On a v2 scenario this is a
  // search rather than a sweep, and the strict grid is a test-suite budget, not
  // a save-path one — a coarser search that finishes is worth more here than a
  // finer one that times out the request.
  return checkBalance(merged, { mode: "fast" });
}

/** Validate without storing — the editor's "check" button. */
export async function checkScenarioDrivers(
  slug: string,
  driversJson: string,
): Promise<ScenarioSaveResult> {
  await requireAdminUser();
  const errors = review(slug, driversJson);
  return errors.length ? { ok: false, errors } : { ok: true };
}

export async function saveScenarioDrivers(
  slug: string,
  driversJson: string,
  note: string,
): Promise<ScenarioSaveResult> {
  const admin = await requireAdminUser();

  const errors = review(slug, driversJson);
  if (errors.length) return { ok: false, errors };

  // Re-serialised from the parsed value rather than stored as typed: it
  // normalises whitespace, and it means the column can only ever hold something
  // that just passed all three checks.
  const { drivers } = parseDriversJson(driversJson);
  const normalised = JSON.stringify(drivers, null, 2);
  const trimmedNote = note.trim() || null;

  await db.simScenarioOverride.upsert({
    where: { slug },
    create: { slug, drivers: normalised, note: trimmedNote, updatedById: admin.id },
    update: { drivers: normalised, note: trimmedNote, updatedById: admin.id },
  });

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Drop the override and go back to the authored scenario.
 *
 * Deleting the row rather than writing the code values back into it is what
 * makes "code is the default" true rather than a slogan: after a reset the
 * scenario tracks future edits to `lib/sim/scenarios` again.
 */
export async function resetScenarioDrivers(slug: string): Promise<ScenarioSaveResult> {
  await requireAdminUser();
  await db.simScenarioOverride.deleteMany({ where: { slug } });
  revalidatePath("/admin");
  return { ok: true };
}
