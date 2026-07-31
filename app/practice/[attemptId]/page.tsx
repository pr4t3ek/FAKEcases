import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PracticeScreen } from "@/components/practice/practice-screen";
import { EvaluationReport } from "@/components/practice/evaluation-report";
import type { PracticeData } from "@/components/practice/types";
import type { AiMode } from "@/lib/config";
import { answerModeFor, type NodeOrigin, type NodeStatus, type TreeMode } from "@/lib/types";
import { diagnosisTrail } from "@/lib/diagnosis";

/** Question JSON columns are strings; malformed data must not break the report. */
function parseJson<T>(raw: string | null): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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
    const answerMode = answerModeFor(attempt.question.type);
    const rootCause = parseJson<{ path: string[] }>(attempt.question.rootCause);
    // The trail section only makes sense when there was a declared answer to
    // narrow toward; a brainstorm case has nothing to compare against.
    const marked = diagnosisTrail(
      attempt.framework.map((f) => ({
        id: f.id,
        parentId: f.parentId,
        label: f.label,
        status: f.status,
      })),
    );
    const trail =
      answerMode === "qualitative" && rootCause?.path?.length
        ? {
            yours: marked.labelPaths,
            actual: rootCause.path,
            cleared: marked.cleared,
            unexamined: marked.unexamined,
            falseClears: attempt.framework
              .filter(
                (f) =>
                  f.status === "healthy" &&
                  rootCause.path.some((p) => f.label.toLowerCase().includes(p.toLowerCase())),
              )
              .map((f) => f.label),
          }
        : null;

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
        finalAnswer={attempt.finalAnswer}
        answerMode={answerMode}
        trail={trail}
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
      answerMode: answerModeFor(attempt.question.type),
      framework: attempt.question.framework,
      // Only whether facts exist crosses to the client — the facts themselves
      // stay server-side, or the tree could be read off the page source.
      hasDataPack: !!attempt.question.dataPack?.trim(),
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
      status: (f.status as NodeStatus | null) ?? null,
      note: f.note,
      sourceMessageId: f.sourceMessageId,
      origin: (f.origin as NodeOrigin | null) ?? null,
    })),
    mode: (attempt.mode as AiMode) || "interviewer",
    finalEstimate: attempt.finalEstimate,
    finalAnswer: attempt.finalAnswer,
    treeMode: (attempt.treeMode as TreeMode | null) ?? null,
    hintsUsed: attempt.hintsUsed,
    timeSpentSec: attempt.timeSpentSec,
  };

  return <PracticeScreen data={data} />;
}
