import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

/**
 * The full logo: mark over the stacked wordmark, with the tagline under it.
 *
 * The big form, for the places that have room to introduce the product — the
 * sign-in pages. The header wears `<Brand />` instead, which is the same mark
 * beside a single line of type.
 *
 * **The words are HTML, not paths.** The artwork's letterforms are a heavy
 * grotesk, and we already ship one (Inter Tight, `font-display`), so setting
 * real text keeps the logo selectable, searchable, translatable and — the part
 * that matters most here — crisp at every size on every screen, without a second
 * copy of the alphabet in the bundle.
 *
 * The amber of the original is the theme's accent throughout: on CLOSED, on the
 * stamp, on the padlock and on the two words of the tagline that carry the joke.
 */
export function BrandLockup({
  className,
  tagline = true,
}: {
  className?: string;
  /** The joke is worth a line on a sign-in page and noise above a form field. */
  tagline?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <BrandMark className="h-16 w-16" />

      <div className="mt-4 font-display font-black leading-[0.85] tracking-tight">
        {/* CASE sits a size above CLOSED, as in the artwork: the stamp is wider
            because it is boxed, so matching their type sizes would make the top
            line read as the smaller of the two. */}
        <div className="text-5xl">CASE</div>

        {/* The stamp: a boxed, slightly-cocked CLOSED with the padlock hung off
            its right edge, as in the artwork. The tilt is small on purpose —
            enough to read as stamped rather than typeset, not so much that it
            looks like a rendering fault. */}
        <div className="relative mt-1.5 inline-block -rotate-2">
          <span className="block border-[3px] border-primary px-3 py-1 text-4xl text-primary">
            CLOSED
          </span>
          {/* Hung off the box rather than set inside it, as in the artwork: it
              overlaps the right edge and breaks the frame, which is what stops
              the stamp reading as a plain bordered word. */}
          <Padlock className="absolute -right-5 -top-3 h-10 w-10 text-primary" />
        </div>
      </div>

      {tagline && (
        <p className="mt-5 text-sm text-muted-foreground">
          <span>
            Because <em className="font-medium not-italic text-primary">“It Depends”</em> Isn&apos;t
            an Answer. 😏
          </span>
        </p>
      )}
    </div>
  );
}

/** Shackle and body, no keyhole: it closes up at the size this is drawn at. */
function Padlock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M11 14v-3.5a5 5 0 0 1 10 0V14"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <rect x="7.5" y="13.5" width="17" height="13" rx="2.5" fill="currentColor" />
      <circle cx="16" cy="19" r="1.9" fill="hsl(var(--background))" />
      <path d="M15.1 19.5h1.8v3.4h-1.8z" fill="hsl(var(--background))" />
    </svg>
  );
}
