import { db } from "@/lib/db";
import { deriveAssumptions } from "@/lib/evaluation";
import { toQuestionContext } from "@/lib/question-context";
import type { InterviewerContext, ConvMessage } from "@/lib/llm";
import type { AiMode } from "@/lib/config";

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

  const ctx: InterviewerContext = {
    question: toQuestionContext(attempt.question),
    mode: (overrideMode ?? (attempt.mode as AiMode)) || "interviewer",
    messages,
    // Same derivation the scorecard uses, so the interviewer probes the figures
    // the candidate actually committed to in the tree and in what they said.
    assumptions: deriveAssumptions({
      framework: attempt.framework,
      userMessageText: messages.filter((m) => m.role === "user").map((m) => m.content),
    }).map((a) => ({ key: a.key, value: a.value, rating: a.rating })),
    framework: attempt.framework.map((f) => ({ label: f.label })),
    finalEstimate: attempt.finalEstimate,
    hintsUsed: attempt.hintsUsed,
  };

  return { ctx, userId: attempt.userId };
}
