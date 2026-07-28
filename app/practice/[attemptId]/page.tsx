import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PracticeScreen } from "@/components/practice/practice-screen";
import { EvaluationReport } from "@/components/practice/evaluation-report";
import type { PracticeData } from "@/components/practice/types";
import type { AiMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/library");

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      question: { include: { category: true } },
      messages: { orderBy: { createdAt: "asc" } },
      calculations: { orderBy: { createdAt: "asc" } },
      framework: { orderBy: { order: "asc" } },
      evaluation: true,
    },
  });
  if (!attempt || attempt.userId !== user.id) redirect("/library");

  // Submitted → show the evaluation report.
  if (attempt.status === "submitted" && attempt.evaluation) {
    return (
      <EvaluationReport
        questionId={attempt.questionId}
        isGuest={user.isGuest}
        question={{
          title: attempt.question.title,
          prompt: attempt.question.prompt,
          unit: attempt.question.unit,
        }}
        finalEstimate={attempt.finalEstimate}
        evaluation={attempt.evaluation}
      />
    );
  }

  const data: PracticeData = {
    attemptId: attempt.id,
    isGuest: user.isGuest,
    showOnboarding: !user.onboardedAt,
    status: attempt.status,
    question: {
      id: attempt.question.id,
      title: attempt.question.title,
      prompt: attempt.question.prompt,
      category: attempt.question.category.name,
      difficulty: attempt.question.difficulty,
      interviewLevel: attempt.question.interviewLevel,
      unit: attempt.question.unit,
    },
    messages: attempt.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        hintLevel: m.hintLevel,
        provider: m.provider,
      })),
    calculations: attempt.calculations.map((c) => ({
      id: c.id,
      expression: c.expression,
      resultText: c.resultText,
    })),
    framework: attempt.framework.map((f) => ({
      id: f.id,
      parentId: f.parentId,
      label: f.label,
      value: f.value,
      multiplier: f.multiplier,
      combine: f.combine === "multiply" ? "multiply" : "sum",
    })),
    mode: (attempt.mode as AiMode) || "interviewer",
    finalEstimate: attempt.finalEstimate,
    hintsUsed: attempt.hintsUsed,
    timeSpentSec: attempt.timeSpentSec,
  };

  return <PracticeScreen data={data} />;
}
