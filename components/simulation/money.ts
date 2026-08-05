/**
 * Which Indian money unit to work in.
 *
 * The allocation UI used to be hardcoded to crore, which was right for the one
 * scenario that existed and wrong for every scenario since: a ₹6 lakh budget
 * rendered as "0.06 cr", and a student typing a sensible number into that field
 * was instantly over budget with no explanation. The unit has to follow the
 * scenario.
 *
 * Pure, and deliberately not a formatter — the allocation inputs need the
 * divisor and the label separately so the number stays editable.
 */

const LAKH = 100_000;
const CRORE = 100 * LAKH;

export interface MoneyScale {
  /** Divide rupees by this to get the displayed number. */
  divisor: number;
  /** "cr" / "L" — goes next to the input. */
  short: string;
  /** "₹ crore" / "₹ lakh" — goes in a field label. */
  label: string;
  /** Sensible step for a number input in this unit. */
  step: number;
}

/**
 * Picks the unit a person would actually say out loud for this budget.
 * A ₹40 lakh budget is "forty lakh", not "0.4 crore".
 */
export function moneyScaleFor(rupees: number): MoneyScale {
  return rupees >= CRORE
    ? { divisor: CRORE, short: "cr", label: "₹ crore", step: 0.5 }
    : { divisor: LAKH, short: "L", label: "₹ lakh", step: 0.5 };
}

/** Render an amount in a given scale, e.g. "₹5.5 L". */
export function inScale(rupees: number, scale: MoneyScale, digits = 1): string {
  return `₹${(rupees / scale.divisor).toFixed(digits)} ${scale.short}`;
}
