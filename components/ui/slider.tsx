"use client";

import { cn } from "@/lib/utils";

/**
 * A styled native range input.
 *
 * Deliberately not `@radix-ui/react-slider`, which is what the rest of the
 * shadcn-style primitives here would suggest. A range input is keyboard
 * accessible, announces its value and bounds to a screen reader, and handles
 * touch — all for free and all without a dependency. The only thing Radix would
 * add here is a multi-thumb API nothing in this app wants.
 *
 * `marker` puts a tick somewhere along the track. The funding panel uses it for
 * the point past which a lever has stopped paying, which is the one piece of
 * information that makes a slider better than a number box.
 */
export function Slider({
  value,
  min = 0,
  max,
  step,
  marker,
  onValueChange,
  className,
  "aria-label": ariaLabel,
  disabled,
}: {
  value: number;
  min?: number;
  max: number;
  step: number;
  /** Position of the tick, in the same units as `value`. */
  marker?: number | null;
  onValueChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  const span = Math.max(1e-9, max - min);
  const markerPct =
    marker != null && marker > min && marker < max ? ((marker - min) / span) * 100 : null;

  return (
    <div className={cn("relative", className)}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onValueChange(+e.target.value)}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
          "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background",
          "[&::-moz-range-thumb]:bg-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      {markerPct !== null && (
        // Behind the thumb and ignoring pointer events, so it can never get in
        // the way of the control it is annotating.
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-2 w-px bg-foreground/40"
          style={{ left: `${markerPct}%` }}
        />
      )}
    </div>
  );
}
