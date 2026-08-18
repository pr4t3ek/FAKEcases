import { cn } from "@/lib/utils";

/**
 * The magnifier-and-king mark, drawn as vector.
 *
 * A redraw of the logo artwork rather than the artwork itself: a raster logo is
 * soft at the sizes this appears at most (a 32px header, a 16px tab) and heavy
 * everywhere else, and it cannot follow the accent if the theme ever moves. Here
 * the ring and the king take `currentColor` and only the sweep is pinned to the
 * accent, so the whole thing is themeable from the outside.
 *
 * **The king is deliberately chunky.** It sits inside a ring at roughly a third
 * of the mark's height, which is 10px in the header — every detail finer than a
 * couple of pixels there is grey mush, so the crown is one cross and one collar
 * rather than the turned profile a print logo can afford.
 *
 * The tab icon (`app/icon.svg`) is the same composition with the king dropped:
 * at 16px there is no room for a figure inside the lens, and a simplified mark
 * at small sizes is the ordinary answer rather than a compromise.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8", className)}
      fill="none"
      aria-hidden="true"
    >
      {/* The accent sweep, outside the lens on the upper left, as in the
          artwork. Radius 22 against the lens's 17, so it reads as a separate
          stroke rather than a thickening of the ring. */}
      <path
        d="M6.6 22.4A23 23 0 0 1 22.4 6.6"
        stroke="hsl(var(--primary))"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Lens. */}
      <circle cx="28" cy="28" r="17" stroke="currentColor" strokeWidth="5.5" />

      {/* Handle, thicker than the ring so it holds at small sizes. */}
      <path
        d="M40.5 40.5 55 55"
        stroke="currentColor"
        strokeWidth="7.5"
        strokeLinecap="round"
      />

      {/*
        The king, filling the lens rather than sitting in it — the figure is the
        subject of the mark and the ring is the frame.

        Sized against the lens's inner radius (~14.2): the base sits 11 below
        centre, where the circle leaves about 8.9 either side, so it stops at
        6.5. Five shapes, no turned profile: at the header's 28px this figure is
        10px tall.
      */}
      <g fill="currentColor">
        {/* Cross finial. */}
        <path d="M26.8 13.2h2.4v7.2h-2.4z" />
        <path d="M24.6 15.4h6.8v2.4h-6.8z" />
        {/* Collar. */}
        <path d="M22.6 20.4h10.8v3.2H22.6z" />
        {/* Body, tapering. */}
        <path d="M23.2 24.6h9.6l-1.7 8.4h-6.2z" />
        {/* Foot. */}
        <path d="M24.2 34.2h7.6l2.6 4.6H21.6z" />
      </g>
    </svg>
  );
}
