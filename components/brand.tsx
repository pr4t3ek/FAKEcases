import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The wordmark, and the same tick that is in the browser tab.
 *
 * The mark is redrawn here rather than imported from `app/icon.svg`, and the
 * duplication is deliberate: that file is consumed by the browser's chrome,
 * which cannot read our CSS variables, so it carries literal colours. This one
 * sits inside the document and uses the tokens, so it stays right if the accent
 * ever moves. The two are the same geometry — change one, change the other.
 *
 * "CLOSED" takes the accent for the same reason "IQ" used to: the second word is
 * the one doing the work in the name.
 */
export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-display font-semibold", className)}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 64 64"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 33.5 L27.5 44 L47 22" />
        </svg>
      </span>
      <span className="tracking-tight">
        CASE <span className="text-primary">CLOSED</span>
      </span>
    </Link>
  );
}
