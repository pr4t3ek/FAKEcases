/**
 * A photo, or the initials standing in for one.
 *
 * Hand-rolled rather than pulled from Radix, matching `./progress.tsx`: the
 * whole behaviour is "show the image, fall back to two letters", and a plain
 * `<img>` with an error handler does it without a dependency that isn't
 * installed.
 *
 * A plain `<img>` and not `next/image`, deliberately. The source is either a
 * same-origin route handler that already sets its own immutable cache header,
 * or an external URL from whichever store is configured — and the optimiser
 * would need every one of those hosts listed in `next.config.mjs` to render at
 * all. There is no `public/` directory and no other image in the app; this is
 * not a corner worth an image pipeline.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-xl",
} as const;

export function Avatar({
  src,
  initials,
  size = "md",
  className,
  alt = "",
}: {
  src?: string | null;
  /** Shown when there is no photo, or when the photo fails to load. */
  initials: string;
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}) {
  // A stored URL can outlive the bytes it points at — an external store cleared,
  // a row wiped by db:reset. Falling back to initials keeps that a cosmetic
  // event rather than a broken-image icon in the header of every page.
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        "bg-primary/10 font-semibold uppercase text-primary",
        SIZES[size],
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- see the note above
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
