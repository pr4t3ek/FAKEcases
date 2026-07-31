import { db } from "@/lib/db";
import { deriveAssumptions } from "@/lib/evaluation";
import { toQuestionContext } from "@/lib/question-context";
import type { InterviewerContext, ConvMessage } from "@/lib/llm";
import type { AiMode } from "@/lib/config";
import { answerModeFor } from "@/lib/types";

/** Build the full interviewer context for an attempt from persisted state. */
export async function loadInterviewerContext(
  attemptId: string,
  overrideMode?: AiMode,
): Promise<{ ctx: InterviewerContext; userId: string } | null> {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      question: { include: { category: true } },
      messages: { orderBy: { createdAt: "asc" } },
      framework: { orderBy: { order: "asc" } },
    },
  });
  if (!attempt) return null;

  const messages: ConvMessage[] = attempt.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as ConvMessage["role"], content: m.content }));

  const answerMode = answerModeFor(attempt.question.type);

  // Facts stay server-side and reach the model only through this context, with
  // instructions to state one when asked and never volunteer the rest.
  let dataPack: { topic: string[]; fact: string }[] | undefined;
  if (attempt.question.dataPack?.trim()) {
    try {
      const parsed = JSON.parse(attempt.question.dataPack);
      if (Array.isArray(parsed)) dataPack = parsed;
    } catch {
      /* malformed authoring shouldn't break the interviewer */
    }
  }

  const ctx: InterviewerContext = {
    question: toQuestionContext(attempt.question),
    mode: (overrideMode ?? (attempt.mode as AiMode)) || "interviewer",
    answerMode,
    messages,
    // Same derivation the scorecard uses, so the interviewer probes the figures —
    // or, in a case, the reasons — the candidate actually committed to.
    assumptions: deriveAssumptions({
      framework: attempt.framework,
      userMessageText: messages.filter((m) => m.role === "user").map((m) => m.content),
      answerMode,
    }).map((a) => ({ key: a.key, value: a.value, rating: a.rating })),
    framework: attempt.framework.map((f) => ({ label: f.label, status: f.status })),
    finalEstimate: attempt.finalEstimate,
    finalAnswer: attempt.finalAnswer,
    dataPack,
    hintsUsed: attempt.hintsUsed,
  };

  return { ctx, userId: attempt.userId };
}
