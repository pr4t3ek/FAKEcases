import { Sparkles } from "lucide-react";
import { proDaysRemaining } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Where the account stands, and what Pro would add.
 *
 * There is no button, because there is nothing to buy yet — no payment gateway
 * is wired up, and a "Go Pro" control that opened nothing would be the one
 * dishonest thing on the page. It says so instead, in the same register as the
 * landing page's disabled Pro card and the forgot-password form.
 *
 * A server component: the tier is a comparison against now, and the server
 * already did it.
 */
export function PlanCard({ proUntil }: { proUntil: Date | null }) {
  const left = proDaysRemaining(proUntil);
  const isPro = left > 0;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Your plan</h2>
          <p className="text-sm text-muted-foreground">
            {isPro
              ? "The whole library is open to you."
              : "Your account opens the free set and saves everything you do."}
          </p>
        </div>
        {isPro ? (
          <Badge variant="success" className="gap-1">
            <Sparkles className="h-3 w-3" /> Pro · {left} {left === 1 ? "day" : "days"} left
          </Badge>
        ) : (
          <Badge variant="muted">Free</Badge>
        )}
      </div>

      {!isPro && (
        <div className="rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">Pro opens the rest of the library</p>
          <p className="mt-1 text-muted-foreground">
            All 24 guesstimates, both cases and all 9 decision war rooms. Hints, Teacher mode
            and your evaluations are already included on the free plan and always will be.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            There&apos;s no way to buy it yet — payments aren&apos;t wired up. An admin can
            grant a pass in the meantime.
          </p>
        </div>
      )}
    </Card>
  );
}
