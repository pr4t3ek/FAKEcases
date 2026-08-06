/**
 * Applying an admin's driver edits on top of an authored scenario.
 *
 * The scenarios in `./scenarios` are the shipped default and stay that way. A
 * `SimScenarioOverride` row replaces one scenario's `drivers` array; everything
 * else — causes, drilldowns, interventions, dashboard, debrief copy — comes from
 * code. Nothing here reads the database, so the pure engine and the tests can
 * take it.
 *
 * Two different jobs, deliberately separated:
 *
 *   - `driversSchema` is the TRUST BOUNDARY. It parses whatever is in the text
 *     column into a `SimDriver[]`, and knows nothing about the scenario. This is
 *     the "admin form" case that `./validate.ts` names as Zod's job.
 *   - `resolveOverride` is the SAFETY NET. It re-checks the merged scenario with
 *     `validateScenario` and falls back to code if the result doesn't hold —
 *     because a driver edit can break references that live in the *unedited*
 *     parts of the scenario, and those parts can also change under a stored
 *     override when the code is redeployed.
 *
 * The balance invariants (`./balance.ts`) are NOT run here. They cost 2^n
 * outcome projections, which is right for a save and wrong for every render of
 * a student's dashboard; `saveScenarioDrivers` runs them at the point of change,
 * and the admin editor re-checks stored overrides on demand.
 */

import { z } from "zod";
import { SIM_UNITS } from "./types";
import { validateScenario } from "./validate";
import type { SimDriver, SimScenario } from "./types";

const driverId = z.string().min(1, "a driver id cannot be empty");

const driverBase = {
  id: driverId,
  label: z.string().min(1, "every driver needs a label"),
  unit: z.enum(SIM_UNITS),
  goodDirection: z.enum(["up", "down"]),
};

/**
 * The driver graph as stored.
 *
 * Mirrors the `SimDriver` union in `./types.ts`. Kept as a discriminated union
 * rather than a loose object so a `product` carrying a stray `baseline`, or an
 * `input` missing one, is a parse failure with a field path rather than a
 * `NaN` that surfaces three screens later as a blank metric.
 */
export const driversSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ ...driverBase, kind: z.literal("input"), baseline: z.number().finite() }),
      z.object({ ...driverBase, kind: z.literal("constant"), value: z.number().finite() }),
      z.object({ ...driverBase, kind: z.literal("product"), of: z.array(driverId).min(1) }),
      z.object({ ...driverBase, kind: z.literal("sum"), of: z.array(driverId).min(1) }),
      z.object({
        ...driverBase,
        kind: z.literal("difference"),
        minuend: driverId,
        subtrahend: driverId,
      }),
      z.object({
        ...driverBase,
        kind: z.literal("quotient"),
        numerator: driverId,
        denominator: driverId,
      }),
    ]),
  )
  .min(1, "a scenario needs at least one driver");

export interface ParseResult {
  drivers?: SimDriver[];
  /** The first failure, phrased for the admin editing the form. */
  error?: string;
}

/** The first Zod issue, as a sentence an author can act on. */
function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "The driver graph could not be read.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Parse a stored or submitted driver array. Shape only — no scenario context. */
export function parseDrivers(input: unknown): ParseResult {
  const parsed = driversSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  return { drivers: parsed.data };
}

/** Parse the JSON text column. Separated so a syntax error reads as one. */
export function parseDriversJson(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: "The stored driver graph is not valid JSON." };
  }
  return parseDrivers(data);
}

/** The scenario with its driver graph swapped. Does not mutate `base`. */
export function withDrivers(base: SimScenario, drivers: SimDriver[]): SimScenario {
  return { ...base, drivers };
}

/**
 * The drivers something in the scenario actually moves — every intervention
 * effect plus the untreated drift.
 *
 * Editing one of these changes what the levers do, and so what the run is
 * graded on; editing any other driver only changes what the dashboard reads.
 * The admin editor marks them so that distinction is visible before the save,
 * rather than discovered afterwards in a balance error.
 */
export function leverDriverIds(scenario: SimScenario): string[] {
  const ids = new Set<string>();
  for (const e of scenario.drift) ids.add(e.driver);
  for (const iv of scenario.interventions) {
    for (const e of iv.effects.whenRootCause) ids.add(e.driver);
    for (const e of iv.effects.otherwise) ids.add(e.driver);
  }
  return [...ids];
}

export interface ResolvedScenario {
  /** Always usable: the merged scenario, or the code default if that failed. */
  scenario: SimScenario;
  /** True when a stored override was applied. */
  overridden: boolean;
  /**
   * Why a stored override was rejected, when one was. Surfaced in the admin
   * editor; students never see it, they just get the authored scenario.
   */
  rejected?: string;
}

/**
 * The code default, with a stored override applied only if it survives checking.
 *
 * Falling back rather than throwing is the whole point of keeping code as the
 * default: a bad row degrades one scenario to its shipped version instead of
 * taking out the page, and the fix is to delete the row.
 */
export function resolveOverride(
  base: SimScenario,
  rawDrivers: string | null | undefined,
): ResolvedScenario {
  if (!rawDrivers) return { scenario: base, overridden: false };

  const { drivers, error } = parseDriversJson(rawDrivers);
  if (!drivers) return { scenario: base, overridden: false, rejected: error };

  const merged = withDrivers(base, drivers);
  const errors = validateScenario(merged);
  if (errors.length) {
    return { scenario: base, overridden: false, rejected: errors[0] };
  }

  return { scenario: merged, overridden: true };
}
