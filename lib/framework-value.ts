import { evaluateExpression } from "@/lib/calc";

/**
 * Input rules for a CHILD framework node's two boxes.
 *
 * A child step is, by definition, a slice of its parent — so its value box only
 * holds a share (0–100%), and an absolute figure ("1.3cr") belongs on a root
 * step instead. Its rate box holds a plain positive number; unlike the share it
 * has no upper bound, since real rates are large (×52 weeks, ×365 days).
 *
 * Root steps keep the full free-form syntax that `evaluateExpression` accepts —
 * these helpers are not applied there.
 */

export const PERCENT_MAX = 100;

/** Drop everything that can't appear in a decimal, and keep only the first ".". */
function stripToDecimal(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

/**
 * Filter (rather than reject) the characters, so a field holding legacy text
 * like "1.3cr" can still be backspaced out of — a strict reject would strand
 * the user on "1.3c". A value over the max IS rejected: returning null leaves
 * the box on its previous, valid contents.
 */
function sanitizeDecimalInput(raw: string, max: number | null): string | null {
  const next = stripToDecimal(raw);
  if (next === "") return "";
  // A bare "." isn't a number yet, but "45." is a decimal mid-entry.
  const n = Number(next);
  if (!Number.isFinite(n)) return null;
  if (max !== null && n > max) return null;
  return next;
}

/** Keystroke filter for a child's share box. Null rejects the edit. */
export function sanitizePercentInput(raw: string): string | null {
  return sanitizeDecimalInput(raw, PERCENT_MAX);
}

/** Keystroke filter for a child's rate box. Null rejects the edit. */
export function sanitizeRateInput(raw: string): string | null {
  return sanitizeDecimalInput(raw, null);
}

/** "45%" -> "45", for the bare-number box. */
export function percentDisplay(stored: string | null | undefined): string {
  const s = stored?.trim() ?? "";
  return s.endsWith("%") ? s.slice(0, -1).trim() : s;
}

/**
 * "45" -> "45%". The "%" is kept in storage so everything downstream —
 * parseNode, the sibling share check, saveFramework, the DB column — sees the
 * same format it always has.
 */
export function percentStore(display: string): string {
  const s = display.trim();
  return s === "" ? "" : `${s}%`;
}

/**
 * Field text for a child's share box. The "%" is part of the input's own value
 * rather than an adornment beside it, so the box never reads as a bare number.
 */
export function percentField(stored: string | null | undefined): string {
  return percentStore(percentDisplay(stored));
}

/**
 * Backspace with the caret at the end of the field. A default backspace there
 * would eat the "%" and the next render would put it straight back, leaving the
 * digits unreachable — so drop the last digit instead.
 */
export function percentBackspace(stored: string | null | undefined): string {
  return percentStore(percentDisplay(stored).slice(0, -1));
}

/**
 * True for a stored child value that this box could not have produced —
 * i.e. data saved before the restriction ("1.3cr", "250%", "3 * 50%"). Such a
 * value is flagged rather than rewritten; the first edit replaces it.
 */
export function isLegacyChildValue(stored: string | null | undefined): boolean {
  const s = stored?.trim();
  if (!s) return false;
  if (!s.endsWith("%")) return true;
  return sanitizePercentInput(percentDisplay(s)) === null;
}

/** Same, for a child's rate box ("1.5k", "3 * 4"). */
export function isLegacyChildRate(stored: string | null | undefined): boolean {
  const s = stored?.trim();
  if (!s) return false;
  return sanitizeRateInput(s) !== s;
}

// ── Reading a value as a chain factor, and a partition as a total ──────────

/**
 * A node's value is a chain factor, not just a label — "40%" and "1.5cr" both
 * parse. A trailing "%" is treated specially since `evaluateExpression` (shared
 * with the calculator tool) doesn't support it. A blank/unparseable value is
 * treated as a neutral ×1 pass-through, so grouping nodes (e.g. "Segment by
 * Income" — which has no value of its own, only its children do) don't break
 * the chain.
 */
export function parseNode(
  raw: string | null | undefined,
): { factor: number; isPercent: boolean } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // The whole value is a percentage — "40%", or an expression of one ("100/3 %").
  const wholePercent = trimmed.match(/^(.+?)\s*%$/);
  if (wholePercent) {
    const n = evaluateExpression(wholePercent[1]);
    if (n !== null) {
      // Only a bare percentage is a SHARE of its parent, and so a term in a
      // partition. "3 * 50%" is a share times a rate (3 cups × half the
      // segment) — a valid factor, but not something that should total 100%
      // against its siblings.
      return { factor: n / 100, isPercent: !wholePercent[1].includes("*") };
    }
  }

  // A percentage embedded mid-expression — "50% * 3" for "half of them, 3 each".
  // evaluateExpression has no "%" operator, so fold each one into a division.
  const inlined = trimmed.replace(/(\d*\.?\d+)\s*%/g, "($1/100)");
  const n = evaluateExpression(inlined);
  return n === null ? null : { factor: n, isPercent: false };
}

export function parseNodeValue(raw: string | null | undefined): number | null {
  return parseNode(raw)?.factor ?? null;
}

/** Absorbs the rounding guesstimates invite — 33+33+33 = 99 is fine. */
export const SHARE_TOTAL_TOLERANCE = 2;

/**
 * What a step's percentage branches add up to, or null when the question
 * doesn't apply.
 *
 * Reads the VALUE box only. A rate in the `×` box is not a share of anything —
 * "×3 cups a day" says nothing about how much of the parent a branch covers —
 * so it can never move this total. And the check runs only when EVERY branch is
 * a bare percentage, because a list mixing "40%" with "₹350" isn't a partition
 * to begin with.
 */
export function shareTotalFor(
  children: { value?: string | null }[],
): number | null {
  if (children.length < 2) return null;
  const parsed = children.map((c) => parseNode(c.value));
  if (!parsed.every((p): p is { factor: number; isPercent: boolean } => !!p?.isPercent)) {
    return null;
  }
  return parsed.reduce((sum, p) => sum + p.factor * 100, 0);
}

/**
 * Only an OVERSHOOT is an error.
 *
 * Branches claiming more than the whole is double-counting — the arithmetic is
 * wrong however you read it. Falling short is not: modelling "the 25% who smoke"
 * and "the 40% in cities" is a deliberate narrowing to the slices the estimate
 * needs, and the rest of the population is simply out of scope. Flagging that
 * told candidates to pad their tree with branches they had no use for.
 */
export function sharesOvershoot(total: number): boolean {
  return total - 100 > SHARE_TOTAL_TOLERANCE;
}
