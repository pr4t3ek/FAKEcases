/**
 * Pro passes: how long one lasts and what granting another does.
 *
 * Pure and DB-free, so the arithmetic can be unit-tested — which matters more
 * than it looks, because getting `nextProUntil` wrong takes time away from
 * someone who just paid for more of it.
 *
 * A pass is a *deadline*, not a subscription. There is no renewal, no mandate
 * and nothing to cancel: `tierFor()` in `lib/entitlements.ts` compares
 * `User.proUntil` against now, so an expired pass downgrades itself. Everything
 * in this file exists to move that one instant correctly.
 */

/** The lengths a pass can be granted in. Prices arrive with a payment gateway. */
export const PRO_PASS_DAYS = [30, 90] as const;
export type ProPassDays = (typeof PRO_PASS_DAYS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a pass should end after granting `days` more.
 *
 * **Extend, never reset.** Granting a second pass while one is still live has to
 * add to the time remaining. Resetting to `now + days` would silently confiscate
 * whatever was left, on precisely the action the user is most likely to be
 * watching — and it is the kind of bug nobody reports, because the number only
 * looks slightly wrong.
 *
 * A pass that already lapsed starts again from now, since there is nothing left
 * to add to.
 */
export function nextProUntil(
  current: Date | null | undefined,
  days: number,
  now: Date = new Date(),
): Date {
  const from = current && current > now ? current : now;
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * Whole days left on a pass, floored at zero.
 *
 * Rounded up rather than down: with eighteen hours left, "1 day" is the honest
 * answer and "0 days" reads as already expired while the account still works.
 */
export function proDaysRemaining(
  proUntil: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!proUntil) return 0;
  const ms = proUntil.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

/** Whether a pass is live at this instant. The same rule `tierFor` applies. */
export function hasActivePro(
  proUntil: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return !!proUntil && proUntil > now;
}
