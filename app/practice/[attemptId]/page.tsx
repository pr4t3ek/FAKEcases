import { redirect } from "next/navigation";
import { turnsRemaining } from "@/lib/llm/budget";
import { getSessionUser } from "@/lib/auth";
import { loadDemoWalkthrough } from "@/lib/walkthrough";
import { db } from "@/lib/db";
import { PracticeScreen } from "@/components/practice/practice-screen";
import { EvaluationReport } from "@/components/practice/evaluation-report";
import type { PracticeData } from "@/components/practice/types";
import { selectableMode } from "@/lib/config";
import { answerModeFor, type NodeOrigin, type NodeStatus, type TreeMode } from "@/lib/types";
import { diagnosisTrail } from "@/lib/diagnosis";
import { labelMatches, solutionWasRevealed } from "@/lib/evaluation";
import { parseJson } from "@/lib/json";
import { questionLeaderboard, questionStanding } from "@/lib/leaderboard";
import { requireBatch } from "@/lib/batch-gate";
import { requirePasswordChange } from "@/lib/password-gate";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/library");
  // A guest practising is exempt — see lib/batch-gate.ts. Anyone with an
  // account answers before the interviewer opens.
  // A reset password opens nothing until it is replaced, so this runs ahead
  // of every other gate.
  requirePasswordChange(user);
  requireBatch(user);

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
    // Loaded here rather than inside the report: the report is a client
    // component, and the board is server data that must not become a fetch
    // waterfall after paint.
    const [board, standing] = await Promise.all([
      questionLeaderboard(attempt.questionId),
      questionStanding(user.id, attempt.questionId, attempt.id),
    ]);
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
            // Same matcher the scorer used, so the report can't name a branch
            // as cleared-too-early that the Diagnosis score never charged for.
            falseClears: attempt.framework
              .filter(
                (f) =>
                  f.status === "healthy" &&
                  rootCause.path.some((p) => labelMatches(f.label, p)),
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
        // Re-derived from the transcript rather than stored on the report, so it
        // always agrees with what the scorer charged for.
        solutionRevealed={solutionWasRevealed(attempt.messages)}
        evaluation={attempt.evaluation}
        userId={user.id}
        leaderboard={board.map((r) => ({
          userId: r.userId,
          rank: r.rank,
          name: r.name,
          batch: r.batch,
          value: r.score,
          detail: String(r.effort),
        }))}
        standing={standing}
      />
    );
  }

  // Only on a first run, and only for a guesstimate — a worked chain of numbers
  // teaches nothing about an issue tree scored on judgement. Null whenever
  // nothing is published, which the overlay handles as its ordinary state.
  const demo =
    !user.onboardedAt && answerModeFor(attempt.question.type) === "numeric"
      ? await loadDemoWalkthrough()
      : null;

  const data: PracticeData = {
    attemptId: attempt.id,
    isGuest: user.isGuest,
    showOnboarding: !user.onboardedAt,
    // Loaded only for a first run. Every other page load skips the query
    // entirely rather than fetching a walkthrough nobody will open.
    demoWalkthrough: demo,
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
        // Carried so the panel can file each turn into its own transcript.
        mode: m.mode,
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
    // Coerced, so an attempt left on a mode that is no longer offered opens
    // on the interviewer rather than on a picker with nothing selected.
    mode: selectableMode(attempt.mode),
    finalEstimate: attempt.finalEstimate,
    finalAnswer: attempt.finalAnswer,
    treeMode: (attempt.treeMode as TreeMode | null) ?? null,
    hintsUsed: attempt.hintsUsed,
    initialRemaining: await turnsRemaining(attempt.id),
    timeSpentSec: attempt.timeSpentSec,
  };

  return <PracticeScreen data={data} />;
}
