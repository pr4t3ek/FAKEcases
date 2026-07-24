"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { evaluationCategories } from "@/lib/config";
import { formatIndianNumber, toIndianWords, cn } from "@/lib/utils";
import type { FeedbackItem } from "@/lib/types";
import { startAttempt } from "@/app/actions/attempts";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EvaluationRow {
  overall: number;
  readiness: string;
  structuring: number;
  logic: number;
  segmentation: number;
  assumptions: number;
  calculation: number;
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
  evaluation,
}: {
  questionId: string;
  isGuest: boolean;
  question: { title: string; prompt: string; unit: string | null };
  finalEstimate: number | null;
  evaluation: EvaluationRow;
}) {
  const feedback: FeedbackItem[] = (() => {
    try {
      return JSON.parse(evaluation.feedback);
    } catch {
      return [];
    }
  })();

  const retry = startAttempt.bind(null, questionId);

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Brand href={isGuest ? "/library" : "/dashboard"} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Export PDF
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
            {finalEstimate != null && (
              <div className="text-sm text-muted-foreground">
                Your estimate: {formatIndianNumber(finalEstimate)} · {toIndianWords(finalEstimate)}{" "}
                {question.unit ?? ""}{" "}
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
              const v = evaluation[cat.key] as number;
              return (
                <div key={cat.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{cat.label}</span>
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
        </Card>

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
        <div className="mt-6 flex flex-wrap gap-3">
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
