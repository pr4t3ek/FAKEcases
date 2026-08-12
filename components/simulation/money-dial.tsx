"use client";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { SaturationHint } from "@/lib/sim/types";
import type { MoneyScale } from "./money";

/**
 * How much money goes behind one fix.
 *
 * A number box was the right control while money was linear: there was nothing
 * to feel, because every rupee was worth the same as the last and the answer
 * was always "as much as the budget allows". Under a saturating curve the
 * interesting question is *where to stop*, and a number box makes that question
 * invisible — you cannot see a knee in a text field.
 *
 * So: a slider for the shape, a number box beside it for the precision, both
 * driving the same value. The tick on the track is where this lever stops
 * paying, and the line underneath says what the next slice buys relative to the
 * first.
 *
 * **What that readout can and cannot say.** It is a ratio of two slopes on the
 * same curve, which cancels the effect size algebraically — so it can tell a
 * student that the next ₹50 L buys a tenth of what the first did, without
 * telling them how much the first did, or whether this lever is the right one
 * at all. That is what makes it shippable to the browser at all; see
 * `SaturationHint`.
 */
export function MoneyDial({
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
          onChange={(e) => onChange(Math.max(0, +e.target.value || 0))}
          className="h-8 w-28 text-right"
        />
      </div>

      <Slider
        className="mt-2"
        value={Math.min(value, max)}
        max={max}
        step={scale.step}
        marker={satiation}
        disabled={disabled}
        aria-label={`Money for ${label}, in ${scale.label}`}
        onValueChange={onChange}
      />

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
  if (value <= 0) return <>Nothing behind this yet.</>;

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
        {share}% of its ask — and past the point where it does much. The last{" "}
        {scale.short} here buys about {asPct}% of what the first did.
      </span>
    );
  }

  return (
    <>
      {share}% of its ask. The next {scale.step} {scale.short} buys about {asPct}% of what the
      first {scale.step} did.
    </>
  );
}
