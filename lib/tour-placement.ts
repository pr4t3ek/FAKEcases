/**
 * Where a tutorial card goes relative to the thing it is pointing at.
 *
 * Pure, and separated from `tutorial-tour.tsx` for one reason: the bug this
 * module exists to fix — the card landing on top of the tree it is explaining —
 * is a wrong number, not a wrong render, and a wrong number should fail a test
 * rather than be noticed by somebody using the app.
 *
 * ## The bug it replaces
 *
 * The original was vertical-only:
 *
 *     let top = rect.bottom + GAP;
 *     if (top + h > vh - GAP) top = rect.top - h - GAP;   // flip above
 *     if (top < GAP) top = Math.max(GAP, vh - h - GAP);   // clamp
 *
 * The last line pins the card to the BOTTOM OF THE VIEWPORT regardless of where
 * the target is — so for any target taller than the space above and below it,
 * overlap is guaranteed. The framework panel is exactly that, and every step
 * that illustrates a tree points at it, so the six steps whose entire purpose
 * was showing a tree being built were the six that covered it.
 *
 * The missing case is the one every popover library has: when a target is too
 * tall to sit above or below, go BESIDE it.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  /** Which rule produced it. Rendered nowhere; read by tests and by anyone debugging. */
  side: "below" | "above" | "right" | "left" | "clamped";
}

/** Keep a coordinate inside the viewport, with the gap respected where possible. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Place the card.
 *
 * Order is below → above → right → left → clamped, and it is a preference
 * order rather than a fallback chain: each is tried only if the card genuinely
 * fits there, so the first three never overlap the target. `clamped` is the
 * last resort — a viewport with no room anywhere, where covering part of the
 * target is better than rendering the card off-screen — and it is the only
 * outcome that may overlap.
 */
export function placeCard(args: {
  target: Rect;
  card: { width: number; height: number };
  viewport: Viewport;
  gap?: number;
}): Placement {
  const { target, card, viewport } = args;
  const gap = args.gap ?? 12;

  const targetBottom = target.top + target.height;
  const targetRight = target.left + target.width;

  // Horizontally centred on the target, for the two vertical placements.
  const centredLeft = clamp(
    target.left + target.width / 2 - card.width / 2,
    gap,
    viewport.width - card.width - gap,
  );

  // Vertically aligned to the target's top for the two side placements, pulled
  // back into view when the target starts near the bottom of a short screen.
  const alignedTop = clamp(target.top, gap, viewport.height - card.height - gap);

  if (targetBottom + gap + card.height <= viewport.height - gap) {
    return { left: centredLeft, top: targetBottom + gap, side: "below" };
  }

  if (target.top - gap - card.height >= gap) {
    return { left: centredLeft, top: target.top - gap - card.height, side: "above" };
  }

  if (targetRight + gap + card.width <= viewport.width - gap) {
    return { left: targetRight + gap, top: alignedTop, side: "right" };
  }

  if (target.left - gap - card.width >= gap) {
    return { left: target.left - gap - card.width, top: alignedTop, side: "left" };
  }

  // Nowhere clear. Centre it and accept the overlap — a card that is readable
  // and in the way beats one that is off-screen.
  return {
    left: clamp(centredLeft, gap, Math.max(gap, viewport.width - card.width - gap)),
    top: clamp(
      viewport.height / 2 - card.height / 2,
      gap,
      Math.max(gap, viewport.height - card.height - gap),
    ),
    side: "clamped",
  };
}

/** Do these two boxes overlap at all? The property the tests care about. */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}
