"use client";

import { Input } from "@/components/ui/input";
import type { SaturationHint } from "@/lib/sim/types";
import type { MoneyScale } from "./money";

/**
 * How much money goes behind one fix.
 *
 * A typed number, and only a typed number. This replaced a slider-plus-box pair
 * whose argument was that a saturating curve makes *where to stop* the
 * interesting question and "you cannot see a knee in a text field" — true as
 * far as it goes, and outweighed by what a slider does to the rest of the
 * exercise. A track invites dragging until something looks right, which is
 * exactly the habit a war room exists to break: every other commitment here is
 * a number a candidate has to mean, and money was the one place they could
 * gesture at an answer instead of naming one.
 *
 * So the knee moves into words. The readout below the box says where this lever
 * stops paying and what the next slice buys relative to the first — the same
 * two facts the tick and the track carried, stated rather than shown.
 *
 * **What that readout can and cannot say.** It is a ratio of two slopes on the
 * same curve, which cancels the effect size algebraically — so it can tell a
 * student that the next ₹50 L buys a tenth of what the first did, without
 * telling them how much the first did, or whether this lever is the right one
 * at all. That is what makes it shippable to the browser at all; see
 * `SaturationHint`.
 */
export function MoneyEntry({
  value,
  max,
  scale,
  hint,
  ask,
  disabled,
  label,
  onChange,
}: {
  /** Money on this line, in the scenario's display unit (lakh or crore). */
  value: number;
  /** Most this line may hold right now — what is left, plus what it holds. */
  max: number;
  scale: MoneyScale;
  hint?: SaturationHint;
  /** What the fix asked for, in display units. */
  ask: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  const satiation = hint?.satiationRupees != null ? hint.satiationRupees / scale.divisor : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{scale.label}</span>
        <Input
          type="number"
          min={0}
          max={max}
          step={scale.step}
          value={value}
          disabled={disabled}
          aria-label={`Money for ${label}, in ${scale.label}`}
          onChange={(e) => onChange(Math.max(0, +e.target.value || 0))}
          className="h-8 w-28 text-right"
        />
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Readout value={value} ask={ask} satiation={satiation} scale={scale} hint={hint} />
      </p>
    </div>
  );
}

function Readout({
  value,
  ask,
  satiation,
  scale,
  hint,
}: {
  value: number;
  ask: number;
  satiation: number | null;
  scale: MoneyScale;
  hint?: SaturationHint;
}) {
  // Nothing typed yet. With no track to look at, this is also the only place
  // the stopping point can be advertised before a number exists — so say it
  // here, where it is still advice rather than a verdict.
  if (value <= 0) {
    if (satiation !== null) {
      return (
        <>
          Nothing behind this yet. It stops paying much past ₹{satiation.toFixed(1)} {scale.short}.
        </>
      );
    }
    return <>Nothing behind this yet.</>;
  }

  const share = Math.round((value / ask) * 100);

  // A v1 scenario ships no hint, and there is no curve to describe — funding is
  // linear to the ask and flat after it, which the "% of what it asked for"
  // line already says.
  if (!hint) return <>{share}% of what it asked for.</>;

  const half = hint.halfAtRupees / scale.divisor;
  // r'(u)/r'(0) for the hyperbola the on-target arm uses. Stated as "the next
  // slice against the first" because a marginal rate means nothing to most
  // people and a comparison means everything.
  const marginal = Math.pow(half / (half + value), 2);
  const asPct = marginal >= 0.1 ? Math.round(marginal * 100) : Math.max(1, Math.round(marginal * 100));

  if (satiation !== null && value >= satiation) {
    return (
      <span className="text-warning">
        {share}% of its ask — and past ₹{satiation.toFixed(1)} {scale.short}, where it stops doing
        much. The last {scale.short} here buys about {asPct}% of what the first did.
      </span>
    );
  }

  return (
    <>
      {share}% of its ask. The next {scale.step} {scale.short} buys about {asPct}% of what the
      first {scale.step} did.
      {satiation !== null && <> It stops paying much past ₹{satiation.toFixed(1)} {scale.short}.</>}
    </>
  );
}
