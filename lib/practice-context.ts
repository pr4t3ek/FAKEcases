import { db } from "@/lib/db";
import { deriveAssumptions } from "@/lib/evaluation";
import { toQuestionContext } from "@/lib/question-context";
import type { InterviewerContext, ConvMessage } from "@/lib/llm";
import { INDIA_REFERENCE_FACTS, type ReferenceFact } from "@/lib/config";
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
  let authored: ReferenceFact[] = [];
  if (attempt.question.dataPack?.trim()) {
    try {
      const parsed = JSON.parse(attempt.question.dataPack);
      if (Array.isArray(parsed)) authored = parsed;
    } catch {
      /* malformed authoring shouldn't break the interviewer */
    }
  }

  const dataPack = withReferenceFacts(authored);

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

/**
 * The question's own facts, plus the shared India reference figures.
 *
 * Without this every guesstimate reached the model with an EMPTY data pack —
 * `renderDataPack` returns "" for an empty list — so the only instruction about
 * numbers was `BASE_INTERVIEWER_RULES`' "NEVER reveal or state the final answer".
 * A candidate asking for a city's population was refused, which is the opposite
 * of what an interviewer does: they would say the number and ask what you intend
 * to do with it.
 *
 * **The question's own facts win a topic outright.** An author who pinned a
 * figure did so because that question's ideal range depends on it, and a generic
 * row quietly contradicting it is exactly the drift `Question.dataPack` exists to
 * prevent. Matched on the topic words rather than the fact text, since two rows
 * about Bangalore are a collision however differently they are phrased.
 */
function withReferenceFacts(authored: ReferenceFact[]): ReferenceFact[] {
  if (!authored.length) return INDIA_REFERENCE_FACTS;

  const claimed = new Set(authored.flatMap((f) => f.topic.map((t) => t.toLowerCase())));
  const shared = INDIA_REFERENCE_FACTS.filter(
    (f) => !f.topic.some((t) => claimed.has(t.toLowerCase())),
  );

  // Authored first: a model reading a long list weights the top of it, and the
  // question-specific facts are the ones that matter to this question.
  return [...authored, ...shared];
}
