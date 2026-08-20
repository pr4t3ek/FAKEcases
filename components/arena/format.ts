/**
 * The arena's units, written out once.
 *
 * The model works in THOUSANDS — thousands of orders and thousands of rupees —
 * because that is what keeps `served × price` a settlement with no scaling
 * factor anywhere (see the units note at the top of `lib/sim/configs/mandi.ts`).
 * Nobody wants to read a board in thousands, so the conversion lives here and
 * nowhere else.
 *
 * `formatValue` from the simulation components does the actual rendering, so
 * the arena reads in the same idiom as every war room — lakhs and crores, not
 * "13414".
 */

import { formatValue } from "@/components/simulation/format";

/** A money figure the model holds in ₹ thousand. */
export function money(thousands: number): string {
  return formatValue(thousands * 1_000, "inr");
}

/** An order count the model holds in thousands of orders. */
export function orders(thousands: number): string {
  return `${formatValue(thousands * 1_000, "count")} orders`;
}

/** Short form for a table cell, where "orders" is already the column heading. */
export function ordersShort(thousands: number): string {
  return formatValue(thousands * 1_000, "count");
}

export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function minutes(value: number): string {
  return `${Math.round(value)} min`;
}

/** ₹ per order — a real per-unit price, never abbreviated to a crore. */
export function rupees(value: number): string {
  return `₹${Math.round(value)}`;
}
