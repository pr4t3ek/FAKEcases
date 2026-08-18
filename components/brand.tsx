import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

/**
 * The header lockup: the mark beside one line of type.
 *
 * The horizontal form of the logo. `<BrandLockup />` is the stacked one, for the
 * sign-in pages where there is room to introduce the product properly.
 *
 * No tile behind the mark any more — the artwork sets it straight on black, and
 * on a near-black header that is what it should do here too. "CLOSED" takes the
 * accent, as the stamp does in the full lockup.
 */
export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-display font-bold", className)}
    >
      <BrandMark className="h-7 w-7" />
      <span className="tracking-tight">
        CASE <span className="text-primary">CLOSED</span>
      </span>
    </Link>
  );
}
