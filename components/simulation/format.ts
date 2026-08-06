/**
 * Rendering a modelled number as a person would write it.
 *
 * Pure, and split out from `sim-dashboard.tsx` for the same reason `money.ts`
 * is: three components format the same values and none of them should have to
 * import a chart library to do it. The causal model never rounds — every
 * rounding decision in the app is here.
 */

import { formatIndianNumber, toIndianWords, assertNever } from "@/lib/utils";
import type { SimUnit } from "@/lib/sim/types";

/** "4.30" → "4.3", "1.92" → "1.92". Only ever applied to a non-integer. */
function trimZeros(fixed: string): string {
  return fixed.replace(/\.?0+$/, "");
}

export function formatValue(value: number, unit: SimUnit): string {
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "ratio":
      // Ratios in this app are conversion-like, so they read better as percent.
      return `${(value * 100).toFixed(1)}%`;
    case "multiple":
      return `${value.toFixed(1)}×`;
    case "inr":
      if (Math.abs(value) >= 1e5) return `₹${toIndianWords(value)}`;
      // Sub-₹100 amounts are real money here — a ₹0.18 cost per impression
      // rounded to "₹0", which made the first link of the chain look broken.
      if (Math.abs(value) < 100 && !Number.isInteger(value)) return `₹${value.toFixed(2)}`;
      return `₹${formatIndianNumber(value)}`;
    case "inr_lakh":
      return `₹${value.toFixed(2)} L`;
    case "inr_crore":
      return `₹${value.toFixed(2)} cr`;
    case "minutes":
      return `${Math.round(value)} min`;
    case "days":
      return `${Math.round(value)}d`;
    case "count":
      if (Math.abs(value) >= 1e5) return toIndianWords(value);
      // Same reason as `inr` above. A "count" here is a per-something as often
      // as it is a tally — 1.92 tickets per seat against a book average of
      // 0.47, a CSAT of 4.3, 1.98 months of payback — and rounding those to
      // "2 against 0" destroys the comparison the panel exists to make.
      if (Math.abs(value) < 100 && !Number.isInteger(value)) {
        return trimZeros(value.toFixed(2));
      }
      return formatIndianNumber(value);
    default:
      return assertNever(unit, "unit");
  }
}
