import "server-only";

/**
 * Scenario loading, with admin overrides applied.
 *
 * `lib/sim/registry.ts` holds the authored scenarios and stays pure — it is what
 * the engine and the test suite read. This is the DB-backed layer on top of it,
 * and the seam the registry's own doc comment anticipated: content still lives
 * in code, but an admin can retune a driver graph without a deploy.
 *
 * Every read falls back to the authored scenario, so an empty
 * `SimScenarioOverride` table (or a row that no longer holds up) is a normal
 * state rather than an outage. See `lib/sim/overlay.ts` for the checking.
 *
 * Not cached. A scenario load is one indexed lookup on a unique column beside
 * the several queries the page already makes, and a stale scenario is a much
 * worse failure than a cheap query — an admin who fixes a wrong number needs it
 * to be wrong for nobody, immediately.
 */

import { db } from "@/lib/db";
import { getScenario, listScenarios } from "@/lib/sim/registry";
import { resolveOverride, type ResolvedScenario } from "@/lib/sim/overlay";
import type { SimScenario } from "@/lib/sim/types";

/** The stored override for a slug, or null. */
async function storedDrivers(slug: string): Promise<string | null> {
  const row = await db.simScenarioOverride.findUnique({
    where: { slug },
    select: { drivers: true },
  });
  return row?.drivers ?? null;
}

/**
 * A scenario ready to play, with any admin override applied.
 *
 * Undefined for an unknown slug, matching `getScenario` — a `SimRun` can outlive
 * the scenario it was played against, and callers already redirect on that.
 */
export async function loadScenario(slug: string): Promise<SimScenario | undefined> {
  const base = getScenario(slug);
  if (!base) return undefined;
  return resolveOverride(base, await storedDrivers(slug)).scenario;
}

/** True when the slug names an authored scenario. Overrides cannot add one. */
export function scenarioExists(slug: string): boolean {
  return getScenario(slug) !== undefined;
}

/** A scenario plus whether it is overridden — the admin editor's view. */
export interface AdminScenario extends ResolvedScenario {
  /** The authored version, so the editor can diff and offer a reset. */
  base: SimScenario;
  note: string | null;
  updatedAt: Date | null;
  updatedByName: string | null;
}

/**
 * Every scenario in library order, annotated for the admin editor.
 *
 * One query for all overrides rather than one per scenario: the editor lists
 * all of them, and nine sequential round trips to render a table is the kind of
 * thing that is invisible on SQLite and painful on a hosted Postgres.
 */
export async function loadAdminScenarios(): Promise<AdminScenario[]> {
  const rows = await db.simScenarioOverride.findMany({
    include: { updatedBy: { select: { name: true, email: true } } },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return listScenarios().map((base) => {
    const row = bySlug.get(base.slug);
    const resolved = resolveOverride(base, row?.drivers ?? null);
    return {
      ...resolved,
      base,
      note: row?.note ?? null,
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedBy?.name ?? row?.updatedBy?.email ?? null,
    };
  });
}

/** One scenario annotated for the admin editor. */
export async function loadAdminScenario(slug: string): Promise<AdminScenario | undefined> {
  const all = await loadAdminScenarios();
  return all.find((s) => s.base.slug === slug);
}
