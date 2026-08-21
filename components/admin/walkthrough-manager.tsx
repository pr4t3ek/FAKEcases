"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  publishWalkthrough,
  removeWalkthrough,
  saveWalkthroughDraft,
  setWalkthroughDemo,
  unpublishWalkthrough,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface WalkthroughRow {
  questionId: string;
  externalId: string | null;
  title: string;
  status: string;
  source: string;
  /** What the chain computes to, from the validator. Null when it cannot. */
  total: number | null;
  idealLow: number | null;
  idealHigh: number | null;
  unit: string | null;
  /** The validator's first complaint, or null when it checks out. */
  problem: string | null;
  stepCount: number;
  stepsJson: string;
}

/**
 * Worked examples, and the one thing an admin has to understand about them.
 *
 * **Publishing is gated on arithmetic, not on judgement.** Every row shows what
 * its chain actually computes to next to the question's own authored range, and
 * the publish button is disabled when the two disagree. That is deliberate and
 * it is not adjustable from this screen: a worked example is the first
 * arithmetic a beginner sees, and one that misses its own answer would teach a
 * wrong method to precisely the people who cannot tell.
 *
 * So a red row is not a warning to weigh up. It is a row that cannot go out
 * until either the steps or the question's range is corrected.
 */
export function WalkthroughManager({
  rows,
  demoExternalId,
}: {
  rows: WalkthroughRow[];
  demoExternalId: string;
}) {
  const [demo, setDemo] = useState(demoExternalId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  const live = rows.find((r) => r.externalId === demo && r.status === "published");

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-semibold">The first-run example</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The question a student is walked through the first time they open a guesstimate. It is
          deliberately not the question they picked — walking somebody through their own would hand
          them its answer, and their attempt would have to go unscored.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={demo}
            onChange={(e) => setDemo(e.target.value)}
            placeholder="chai-bangalore-daily"
            className="max-w-xs font-mono text-sm"
            aria-label="Demo question external id"
          />
          <Button
            size="sm"
            disabled={pending || demo === demoExternalId}
            onClick={() => run(() => setWalkthroughDemo(demo), "Demo question updated")}
          >
            {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
        {live ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            Students are seeing “{live.title}”.
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-500">
            <TriangleAlert className="h-4 w-4" />
            Nothing is published for this id — the walkthrough is switched off for new students.
          </p>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No walkthroughs yet. Draft one with{" "}
          <code className="font-mono">npx tsx scripts/draft-walkthrough.ts &lt;externalId&gt;</code>.
        </Card>
      ) : (
        <Card className="divide-y">
          {rows.map((row) => {
            const broken = row.problem !== null;
            return (
              <div key={row.questionId} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.title}</span>
                    <Badge variant={row.status === "published" ? "default" : "secondary"}>
                      {row.status}
                    </Badge>
                    <Badge variant="outline">{row.source}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {row.stepCount} steps
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">{row.externalId}</p>

                  <p
                    className={cn(
                      "mt-2 text-sm",
                      broken ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {broken ? (
                      row.problem
                    ) : (
                      <>
                        Chain comes to{" "}
                        <span className="font-mono font-medium">
                          {row.total?.toLocaleString("en-IN")}
                        </span>{" "}
                        {row.unit ?? ""} — inside{" "}
                        <span className="font-mono">
                          {row.idealLow?.toLocaleString("en-IN")}–
                          {row.idealHigh?.toLocaleString("en-IN")}
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row.status === "published" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => unpublishWalkthrough(row.questionId), "Pulled back to draft")
                      }
                    >
                      <EyeOff className="mr-1 h-4 w-4" />
                      Unpublish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      // The gate. A chain that misses its own question's range
                      // cannot be published from here at all — the action
                      // refuses too, so this is the courtesy and that is the
                      // control.
                      disabled={pending || broken}
                      title={broken ? "The arithmetic has to check out first." : undefined}
                      onClick={() =>
                        run(() => publishWalkthrough(row.questionId), "Published to students")
                      }
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Publish
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`Delete the worked example for “${row.title}”?`)) return;
                      run(() => removeWalkthrough(row.questionId), "Deleted");
                    }}
                    aria-label="Delete walkthrough"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/** Re-exported so the page can build rows without importing the action module. */
export { saveWalkthroughDraft };
