"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Lightbulb,
  RotateCcw,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { categoryLabel, evaluationCategories } from "@/lib/config";
import { formatIndianNumber, toIndianWords, cn } from "@/lib/utils";
import type { AnswerMode, FeedbackItem } from "@/lib/types";
import { startAttempt } from "@/app/actions/attempts";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EvaluationRow {
  overall: number;
  readiness: string;
  /** Null means "not applicable to this attempt" — see the Evaluation model. */
  structuring: number | null;
  logic: number;
  segmentation: number | null;
  assumptions: number;
  calculation: number | null;
  diagnosis: number | null;
  communication: number;
  business: number;
  confidence: number;
  accuracyHit: boolean;
  feedback: string;
  betterApproach: string;
  sampleSolution: string;
}

const readinessTone: Record<string, string> = {
  "Interview Ready": "text-success",
  Advanced: "text-primary",
  Intermediate: "text-warning",
  Beginner: "text-muted-foreground",
};

function scoreColor(v: number): string {
  if (v >= 80) return "bg-success";
  if (v >= 60) return "bg-primary";
  if (v >= 45) return "bg-warning";
  return "bg-destructive";
}

const feedbackIcon = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  tip: Lightbulb,
};
const feedbackTone = {
  positive: "text-success",
  warning: "text-warning",
  tip: "text-primary",
};

export function EvaluationReport({
  questionId,
  isGuest,
  question,
  finalEstimate,
  finalAnswer,
  answerMode = "numeric",
  trail,
  evaluation,
}: {
  questionId: string;
  isGuest: boolean;
  question: { title: string; prompt: string; unit: string | null };
  finalEstimate: number | null;
  finalAnswer?: string | null;
  answerMode?: AnswerMode;
  /** The marked trail against the declared root cause, for a diagnostic case. */
  trail?: {
    yours: string[][];
    actual: string[] | null;
    cleared: number;
    unexamined: number;
    falseClears: string[];
  } | null;
  evaluation: EvaluationRow;
}) {
  const feedback: FeedbackItem[] = (() => {
    try {
      return JSON.parse(evaluation.feedback);
    } catch {
      return [];
    }
  })();

  // Both args bound so the retry form action takes no parameters.
  const retry = startAttempt.bind(null, questionId, undefined);

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b px-4 print:hidden">
        <Brand href={isGuest ? "/library" : "/dashboard"} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="container max-w-3xl py-8">
        <p className="text-sm text-muted-foreground">Evaluation</p>
        <h1 className="text-2xl font-bold tracking-tight">{question.title}</h1>

        {/* Overall */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="mt-5 flex flex-col items-center gap-2 p-8 text-center">
            <Trophy className="h-8 w-8 text-primary" />
            <div className="text-5xl font-bold tabular-nums">{evaluation.overall}
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <div className={cn("text-lg font-semibold", readinessTone[evaluation.readiness])}>
              {evaluation.readiness}
            </div>
            {/* A case has no range to land in, so it shows the recommendation
                rather than a number and an accuracy badge that can't apply. */}
            {answerMode === "qualitative"
              ? finalAnswer?.trim() && (
                  <p className="max-w-lg text-sm text-muted-foreground">
                    &ldquo;{finalAnswer.trim()}&rdquo;
                  </p>
                )
              : finalEstimate != null && (
                  <div className="text-sm text-muted-foreground">
                    Your estimate: {formatIndianNumber(finalEstimate)} ·{" "}
                    {toIndianWords(finalEstimate)} {question.unit ?? ""}{" "}
                    {evaluation.accuracyHit ? (
                      <Badge variant="success" className="ml-1">within range</Badge>
                    ) : (
                      <Badge variant="muted" className="ml-1">outside ideal range</Badge>
                    )}
                  </div>
                )}
          </Card>
        </motion.div>

        {/* Category scores */}
        <Card className="mt-5 p-6">
          <h2 className="mb-4 font-semibold">Category scores</h2>
          <div className="space-y-3">
            {evaluationCategories.map((cat) => {
              const v = evaluation[cat.key] as number | null;
              // A null category was never in play for this attempt — calculation
              // on a qualitative question, diagnosis where no root cause is
              // declared, structure on a guided tree. Saying so is honest; a
              // zero bar would read as a failure the candidate never had a shot
              // at, and would drag the eye more than the score it isn't in.
              if (v == null) return null;
              return (
                <div key={cat.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{categoryLabel(cat, answerMode)}</span>
                    <span className="font-medium tabular-nums">{v}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn("h-full rounded-full", scoreColor(v))}
                      initial={{ width: 0 }}
                      animate={{ width: `${v}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            const skipped = evaluationCategories.filter(
              (c) => (evaluation[c.key] as number | null) == null,
            );
            if (skipped.length === 0) return null;
            return (
              <p className="mt-4 rounded-lg border border-dashed p-2.5 text-center text-xs text-muted-foreground">
                Not scored for this question:{" "}
                {skipped.map((c) => categoryLabel(c, answerMode)).join(", ")}
              </p>
            );
          })()}
        </Card>

        {/* Where the diagnosis went, against where the problem actually was. */}
        {trail && (
          <Card className="mt-5 p-6">
            <h2 className="mb-4 font-semibold">Your diagnosis</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex flex-wrap gap-x-3">
                <dt className="w-32 shrink-0 text-muted-foreground">You narrowed to</dt>
                <dd className="font-medium">
                  {trail.yours.length
                    ? trail.yours.map((p) => p.join(" → ")).join("  ·  ")
                    : "— nothing marked"}
                </dd>
              </div>
              {trail.actual && (
                <div className="flex flex-wrap gap-x-3">
                  <dt className="w-32 shrink-0 text-muted-foreground">The problem was</dt>
                  <dd className="font-medium text-success">{trail.actual.join(" → ")}</dd>
                </div>
              )}
              <div className="flex flex-wrap gap-x-3">
                <dt className="w-32 shrink-0 text-muted-foreground">Ruled out</dt>
                <dd>
                  {trail.cleared} branch{trail.cleared === 1 ? "" : "es"}
                  {trail.unexamined > 0 && `, ${trail.unexamined} never examined`}
                </dd>
              </div>
              {trail.falseClears.length > 0 && (
                <div className="flex flex-wrap gap-x-3">
                  <dt className="w-32 shrink-0 text-muted-foreground">Cleared too early</dt>
                  <dd className="font-medium text-warning">{trail.falseClears.join(", ")}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}

        {/* Feedback */}
        <Card className="mt-5 p-6">
          <h2 className="mb-4 font-semibold">Feedback</h2>
          <ul className="space-y-3">
            {feedback.map((f, i) => {
              const Icon = feedbackIcon[f.tone];
              return (
                <li key={i} className="flex gap-2.5 text-sm">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", feedbackTone[f.tone])} />
                  <span>{f.text}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Better approach */}
        {evaluation.betterApproach && (
          <Card className="mt-5 p-6">
            <h2 className="mb-2 font-semibold">Suggested better approach</h2>
            <p className="text-sm text-muted-foreground">{evaluation.betterApproach}</p>
          </Card>
        )}

        {/* Sample solution — unlocked after submit */}
        {evaluation.sampleSolution && (
          <Card className="mt-5 border-primary/30 bg-primary/5 p-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-semibold">Sample solution</h2>
              <Badge>unlocked</Badge>
            </div>
            <p className="text-sm">{evaluation.sampleSolution}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Illustrative reference — not the single &ldquo;right&rdquo; answer.
            </p>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <form action={retry}>
            <Button type="submit" variant="outline">
              <RotateCcw className="h-4 w-4" /> Retry this question
            </Button>
          </form>
          <Button asChild>
            <Link href="/library">
              Practise another <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {isGuest ? (
            <Button asChild variant="secondary">
              <Link href="/signup">Save progress — sign up</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
